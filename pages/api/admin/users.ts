import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession, readUsers } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin";

const COOKIE_NAME = "mindlyst_session";

async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const session = await getSession(token);
  return session?.userId ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const admin = await isUserAdmin(userId);
  if (!admin) {
    return res.status(403).json({ error: "Accès réservé aux administrateurs" });
  }

  const searchRaw = typeof req.query.search === "string" ? req.query.search : "";
  const search = searchRaw.trim().toLowerCase();

  const allUsers = await readUsers();
  const totalUsers = allUsers.length;

  const filtered = search
    ? allUsers.filter((user) => user.username?.toLowerCase().includes(search))
    : allUsers;

  const users = filtered
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      isAdmin: user.isAdmin === true,
    }));

  return res.status(200).json({
    totalUsers,
    count: users.length,
    users,
  });
}


