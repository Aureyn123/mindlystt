import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, parseCookies } from "@/lib/auth";
import { getNoteById, updateNote, deleteNote, type NoteCategory } from "@/lib/notes";

const COOKIE_NAME = "mindlyst_session";
const ALLOWED_CATEGORIES: NoteCategory[] = ["business", "perso", "sport", "clients", "urgent", "autres"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const session = await getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Session expirée" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  if (req.method === "PUT") {
    const { title, text, category } = req.body as { title?: string; text?: string; category?: NoteCategory };
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Le titre est requis" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Le texte est requis" });
    }
    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Catégorie invalide" });
    }

    const note = await updateNote(id, session.userId, { title, text, category });
    if (!note) {
      return res.status(404).json({ error: "Note introuvable" });
    }

    return res.status(200).json({ note });
  }

  if (req.method === "DELETE") {
    const deleted = await deleteNote(id, session.userId);
    if (!deleted) {
      return res.status(404).json({ error: "Note introuvable" });
    }

    const note = await getNoteById(id);
    return res.status(200).json({ note: note || { id } });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée" });
}
