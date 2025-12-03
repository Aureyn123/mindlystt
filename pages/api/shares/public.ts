import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession } from "@/lib/auth";
import { getPublicShareByToken, deletePublicShare, getPublicSharesByNote } from "@/lib/shares";
import { getNoteById } from "@/lib/notes";

const COOKIE_NAME = "mindlyst_session";

async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await getSession(token);
  return session?.userId ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { token } = req.query as { token?: string };
    if (!token) {
      return res.status(400).json({ error: "Token requis" });
    }

    const publicShare = await getPublicShareByToken(token);
    if (!publicShare) {
      return res.status(404).json({ error: "Lien de partage invalide ou expiré" });
    }

    // Récupérer la note
    const note = await getNoteById(publicShare.noteId);
    if (!note) {
      return res.status(404).json({ error: "Note non trouvée" });
    }

    return res.status(200).json({ note, share: publicShare });
  }

  if (req.method === "DELETE") {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { noteId } = req.body as { noteId?: string };
    if (!noteId) {
      return res.status(400).json({ error: "noteId requis" });
    }

    // Vérifier que l'utilisateur est propriétaire de la note
    const note = await getNoteById(noteId);
    if (!note || note.userId !== userId) {
      return res.status(403).json({ error: "Vous n'êtes pas propriétaire de cette note" });
    }

    const publicShares = await getPublicSharesByNote(noteId);
    for (const share of publicShares) {
      await deletePublicShare(share.id);
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée" });
}

