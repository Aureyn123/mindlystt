// Gestion du partage de notes
import { readJson, writeJson } from "./db";

export type ShareType = "note" | "task" | "habit" | "reminder";

export type NoteShare = {
  id: string;
  noteId: string;
  ownerId: string; // Propriétaire de la note
  sharedWithId: string; // Utilisateur avec qui la note est partagée
  permission: "read" | "write"; // Permission : lecture seule ou modification
  createdAt: number;
  type?: ShareType; // Type de partage (par défaut "note" pour rétrocompatibilité)
};

export type TaskShare = {
  id: string;
  taskId: string;
  ownerId: string;
  sharedWithId: string;
  permission: "read" | "write";
  createdAt: number;
  type: "task";
};

export type HabitShare = {
  id: string;
  habitId: string;
  ownerId: string;
  sharedWithId: string;
  permission: "read" | "write";
  createdAt: number;
  type: "habit";
};

export type ReminderShare = {
  id: string;
  reminderId: string;
  ownerId: string;
  sharedWithId: string;
  permission: "read" | "write";
  createdAt: number;
  type: "reminder";
};

export type AnyShare = NoteShare | TaskShare | HabitShare | ReminderShare;

export type PublicShare = {
  id: string;
  noteId: string;
  ownerId: string;
  shareToken: string; // Token unique pour le lien public
  createdAt: number;
  expiresAt?: number; // Optionnel : expiration du lien
};

const SHARES_FILE = "shares.json";
const PUBLIC_SHARES_FILE = "public-shares.json";

export async function loadShares(): Promise<AnyShare[]> {
  return await readJson<AnyShare[]>(SHARES_FILE, []);
}

export async function saveShares(shares: AnyShare[]): Promise<void> {
  await writeJson(SHARES_FILE, shares);
}

export async function loadPublicShares(): Promise<PublicShare[]> {
  return await readJson<PublicShare[]>(PUBLIC_SHARES_FILE, []);
}

export async function savePublicShares(shares: PublicShare[]): Promise<void> {
  await writeJson(PUBLIC_SHARES_FILE, shares);
}

// Fonction générique pour créer un partage
export async function createShareGeneric(
  itemId: string,
  ownerId: string,
  sharedWithId: string,
  type: ShareType,
  permission: "read" | "write" = "read"
): Promise<AnyShare> {
  const shares = await loadShares();
  
  // Vérifier si le partage existe déjà
  const existing = shares.find((s) => {
    if (type === "note") return (s as NoteShare).noteId === itemId && s.sharedWithId === sharedWithId;
    if (type === "task") return (s as TaskShare).taskId === itemId && s.sharedWithId === sharedWithId;
    if (type === "habit") return (s as HabitShare).habitId === itemId && s.sharedWithId === sharedWithId;
    if (type === "reminder") return (s as ReminderShare).reminderId === itemId && s.sharedWithId === sharedWithId;
    return false;
  });
  
  if (existing) {
    existing.permission = permission;
    await saveShares(shares);
    return existing;
  }

  let share: AnyShare;
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  if (type === "note") {
    share = { id, noteId: itemId, ownerId, sharedWithId, permission, createdAt: Date.now(), type: "note" } as NoteShare;
  } else if (type === "task") {
    share = { id, taskId: itemId, ownerId, sharedWithId, permission, createdAt: Date.now(), type: "task" } as TaskShare;
  } else if (type === "habit") {
    share = { id, habitId: itemId, ownerId, sharedWithId, permission, createdAt: Date.now(), type: "habit" } as HabitShare;
  } else {
    share = { id, reminderId: itemId, ownerId, sharedWithId, permission, createdAt: Date.now(), type: "reminder" } as ReminderShare;
  }

  shares.push(share);
  await saveShares(shares);
  return share;
}

// Fonction de compatibilité pour les notes
export async function createShare(
  noteId: string,
  ownerId: string,
  sharedWithId: string,
  permission: "read" | "write" = "read"
): Promise<NoteShare> {
  return createShareGeneric(noteId, ownerId, sharedWithId, "note", permission) as Promise<NoteShare>;
}

export async function deleteShare(shareId: string): Promise<void> {
  console.log("🗑️ deleteShare appelé avec shareId:", shareId);
  const shares = await loadShares();
  console.log("📋 Partages avant suppression:", shares.length);
  const filtered = shares.filter((s) => s.id !== shareId);
  console.log("📋 Partages après filtrage:", filtered.length);
  if (filtered.length === shares.length) {
    console.error("❌ Aucun partage supprimé ! Le shareId n'existe peut-être pas.");
  }
  await saveShares(filtered);
  console.log("✅ Partages sauvegardés");
}

export async function getSharesForUser(userId: string, type?: ShareType): Promise<AnyShare[]> {
  const shares = await loadShares();
  let filtered = shares.filter((s) => s.sharedWithId === userId);
  if (type) {
    filtered = filtered.filter((s) => s.type === type || (!s.type && type === "note"));
  }
  return filtered;
}

export async function getSharesByOwner(ownerId: string, type?: ShareType): Promise<AnyShare[]> {
  const shares = await loadShares();
  let filtered = shares.filter((s) => s.ownerId === ownerId);
  if (type) {
    filtered = filtered.filter((s) => s.type === type || (!s.type && type === "note"));
  }
  return filtered;
}

export async function getSharesByNote(noteId: string): Promise<AnyShare[]> {
  const shares = await loadShares();
  return shares.filter((s) => (s as NoteShare).noteId === noteId);
}

export async function getSharesByTask(taskId: string): Promise<TaskShare[]> {
  const shares = await loadShares();
  return shares.filter((s) => s.type === "task" && (s as TaskShare).taskId === taskId) as TaskShare[];
}

export async function getSharesByHabit(habitId: string): Promise<HabitShare[]> {
  const shares = await loadShares();
  return shares.filter((s) => s.type === "habit" && (s as HabitShare).habitId === habitId) as HabitShare[];
}

export async function getSharesByReminder(reminderId: string): Promise<ReminderShare[]> {
  const shares = await loadShares();
  return shares.filter((s) => s.type === "reminder" && (s as ReminderShare).reminderId === reminderId) as ReminderShare[];
}

function isNoteShare(s: any): s is NoteShare {
  return s.type === "note" && typeof s.noteId === "string" && typeof s.sharedWithId === "string";
}

export async function canUserAccessNote(
  userId: string,
  noteId: string
): Promise<{ canAccess: boolean; permission?: "read" | "write" }> {
  const shares = await loadShares();
  const share = shares.find(
    (s) => isNoteShare(s) && s.noteId === noteId && s.sharedWithId === userId
  );

  if (share) {
    return { canAccess: true, permission: share.permission };
  }
  return { canAccess: false };
}

// Partages publics (liens de partage)
export function generateShareToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
}

export async function createPublicShare(
  noteId: string,
  ownerId: string,
  expiresInDays?: number
): Promise<PublicShare> {
  const publicShares = await loadPublicShares();
  
  // Vérifier si un partage public existe déjà pour cette note
  const existing = publicShares.find((s) => s.noteId === noteId && s.ownerId === ownerId);
  if (existing) {
    return existing;
  }

  const share: PublicShare = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    noteId,
    ownerId,
    shareToken: generateShareToken(),
    createdAt: Date.now(),
    expiresAt: expiresInDays ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : undefined,
  };

  publicShares.push(share);
  await savePublicShares(publicShares);
  return share;
}

export async function getPublicShareByToken(token: string): Promise<PublicShare | null> {
  const publicShares = await loadPublicShares();
  const share = publicShares.find((s) => s.shareToken === token);
  
  if (!share) return null;
  
  // Vérifier l'expiration
  if (share.expiresAt && share.expiresAt < Date.now()) {
    return null;
  }
  
  return share;
}

export async function deletePublicShare(shareId: string): Promise<void> {
  const publicShares = await loadPublicShares();
  const filtered = publicShares.filter((s) => s.id !== shareId);
  await savePublicShares(filtered);
}

export async function getPublicSharesByNote(noteId: string): Promise<PublicShare[]> {
  const publicShares = await loadPublicShares();
  return publicShares.filter((s) => s.noteId === noteId);
}

