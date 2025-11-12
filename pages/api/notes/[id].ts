import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, parseCookies } from "@/lib/auth";
import { readJson, writeJson } from "@/lib/db";

type NoteCategory = "business" | "perso" | "sport" | "clients" | "urgent" | "autres";

type NoteRecord = {
  id: string;
  userId: string;
  title: string;
  text: string;
  category: NoteCategory;
  createdAt: number;
};

const NOTES_FILE = "notes.json";
const COOKIE_NAME = "mindlyst_session";
const ALLOWED_CATEGORIES: NoteCategory[] = ["business", "perso", "sport", "clients", "urgent", "autres"];

async function loadNotes(): Promise<NoteRecord[]> {
  return readJson<NoteRecord[]>(NOTES_FILE, []);
}

async function saveNotes(notes: NoteRecord[]) {
  await writeJson(NOTES_FILE, notes);
}

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

    const notes = await loadNotes();
    const noteIndex = notes.findIndex(note => note.id === id && note.userId === session.userId);
    if (noteIndex === -1) {
      return res.status(404).json({ error: "Note introuvable" });
    }

    notes[noteIndex] = {
      ...notes[noteIndex],
      title: title.trim(),
      text: text.trim(),
      category
    };
    await saveNotes(notes);
    return res.status(200).json({ note: notes[noteIndex] });
  }

  if (req.method === "DELETE") {
    const notes = await loadNotes();
    const noteIndex = notes.findIndex(note => note.id === id && note.userId === session.userId);
    if (noteIndex === -1) {
      return res.status(404).json({ error: "Note introuvable" });
    }

    const [removed] = notes.splice(noteIndex, 1);
    await saveNotes(notes);
    return res.status(200).json({ note: removed });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée" });
}

