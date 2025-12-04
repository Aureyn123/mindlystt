import crypto from "crypto";
import type { NextApiRequest } from "next";
import { prisma } from "./prisma";

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Types conservés pour compatibilité
export type UserRecord = {
  id: string;
  email: string;
  username: string; // Pseudo unique
  passwordHash: string;
  createdAt: number;
  isAdmin?: boolean;
  customCategories?: string[];
};

export type SessionRecord = {
  token: string;
  userId: string;
  expiresAt: number;
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${ITERATIONS}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, iterString, originalHash] = storedHash.split(":");
  const iterations = Number(iterString);
  if (!salt || !iterations || !originalHash) {
    return false;
  }
  const derived = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(originalHash, "hex"));
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function parseCookies(req: NextApiRequest | { headers: { cookie?: string } }): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, pair) => {
    const [key, value] = pair.split("=").map(part => part?.trim());
    if (key) acc[key] = decodeURIComponent(value ?? "");
    return acc;
  }, {});
}

// ============================================
// Fonctions migrées vers Prisma
// ============================================

export async function readUsers(): Promise<UserRecord[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  
  // Convertir les types Prisma vers UserRecord
  return users.map(user => {
    let customCategories: string[] | undefined = undefined;
    if (user.customCategories) {
      try {
        customCategories = JSON.parse(user.customCategories);
      } catch {
        // Si ce n'est pas du JSON valide, on laisse undefined
        customCategories = undefined;
      }
    }
    
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt.getTime(),
      isAdmin: user.isAdmin,
      customCategories,
    };
  });
}

export async function writeUsers(users: UserRecord[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée car on utilise directement Prisma
  // Mais on la garde pour compatibilité
  for (const user of users) {
    // Convertir customCategories de string[] vers string JSON
    const customCategoriesJson = user.customCategories 
      ? JSON.stringify(user.customCategories) 
      : null;
    
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        username: user.username,
        passwordHash: user.passwordHash,
        isAdmin: user.isAdmin || false,
        customCategories: customCategoriesJson,
      },
      create: {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.passwordHash,
        isAdmin: user.isAdmin || false,
        customCategories: customCategoriesJson,
        createdAt: new Date(user.createdAt),
      },
    });
  }
}

export async function readSessions(): Promise<SessionRecord[]> {
  const now = new Date();
  
  // Supprimer les sessions expirées
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  
  const sessions = await prisma.session.findMany({
    where: { expiresAt: { gt: now } },
  });
  
  return sessions.map(session => ({
    token: session.token,
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
  }));
}

export async function writeSessions(sessions: SessionRecord[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée mais on la garde pour compatibilité
  // On nettoie d'abord les sessions existantes
  await prisma.session.deleteMany({});
  
  // Puis on recrée toutes les sessions
  for (const session of sessions) {
    await prisma.session.create({
      data: {
        token: session.token,
        userId: session.userId,
        expiresAt: new Date(session.expiresAt),
      },
    });
  }
}

export async function getSession(token: string): Promise<SessionRecord | undefined> {
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { token },
  });
  
  if (!session || session.expiresAt <= now) {
    if (session) {
      // Supprimer la session expirée
      await prisma.session.delete({ where: { token } });
    }
    return undefined;
  }
  
  return {
    token: session.token,
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
  };
}

export async function createSession(userId: string): Promise<SessionRecord> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  
  const session = await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
  
  return {
    token: session.token,
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
  };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}
