import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession, readUsers } from "@/lib/auth";
import { getSharesByOwner, type NoteShare, type AnyShare } from "@/lib/shares";
import { readJson } from "@/lib/db";

const COOKIE_NAME = "mindlyst_session";

async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await getSession(token);
  return session?.userId ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    // Récupérer les partages créés par l'utilisateur
    const shares = await getSharesByOwner(userId);
    
    if (shares.length === 0) {
      return res.status(200).json({ shares: [] });
    }

    // Récupérer les utilisateurs et les notes
    const users = await readUsers();
    const notes = await readJson<any[]>("notes.json", []);

    // Construire les détails avec pseudos, emails et titres
    const noteShares = shares.filter((share): share is NoteShare => {
      return share.type === "note" || (!share.type && typeof (share as NoteShare).noteId === "string");
    });

    const sharesWithDetails = noteShares.map((share) => {
      const sharedWithUser = users.find((u) => u.id === share.sharedWithId);
      const note = notes.find((n) => n.id === share.noteId);
      return {
        shareId: share.id,
        noteId: share.noteId,
        noteTitle: note?.title || "Note",
        sharedWithUsername: sharedWithUser?.username || sharedWithUser?.email?.split("@")[0] || "Utilisateur inconnu",
        sharedWithEmail: sharedWithUser?.email || "Utilisateur inconnu",
        permission: share.permission,
      };
    });

    return res.status(200).json({ shares: sharesWithDetails });
  } catch (error) {
    console.error("Erreur lors de la récupération des détails des partages:", error);
    return res.status(500).json({ error: "Erreur lors de la récupération des détails" });
  }
}

