// Gestion des notes
import { prisma } from "./prisma";
import crypto from "crypto";

export type NoteCategory = "business" | "perso" | "sport" | "clients" | "urgent" | "autres";

export type NoteRecord = {
  id: string;
  userId: string;
  title: string;
  text: string;
  category: NoteCategory;
  createdAt: number;
};

export async function getUserNotes(userId: string): Promise<NoteRecord[]> {
  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  
  return notes.map(note => ({
    id: note.id,
    userId: note.userId,
    title: note.title,
    text: note.text,
    category: note.category as NoteCategory,
    createdAt: note.createdAt.getTime(),
  }));
}

export async function getNoteById(noteId: string): Promise<NoteRecord | null> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
  });
  
  if (!note) return null;
  
  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    text: note.text,
    category: note.category as NoteCategory,
    createdAt: note.createdAt.getTime(),
  };
}

export async function createNote(
  userId: string,
  title: string,
  text: string,
  category: NoteCategory
): Promise<NoteRecord> {
  const note = await prisma.note.create({
    data: {
      userId,
      title: title.trim(),
      text: text.trim(),
      category,
    },
  });
  
  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    text: note.text,
    category: note.category as NoteCategory,
    createdAt: note.createdAt.getTime(),
  };
}

export async function updateNote(
  noteId: string,
  userId: string,
  updates: { title?: string; text?: string; category?: NoteCategory }
): Promise<NoteRecord | null> {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
    },
  });
  
  if (!note) return null;
  
  const updated = await prisma.note.update({
    where: { id: noteId },
    data: {
      ...(updates.title !== undefined && { title: updates.title.trim() }),
      ...(updates.text !== undefined && { text: updates.text.trim() }),
      ...(updates.category !== undefined && { category: updates.category }),
    },
  });
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    text: updated.text,
    category: updated.category as NoteCategory,
    createdAt: updated.createdAt.getTime(),
  };
}

export async function deleteNote(noteId: string, userId: string): Promise<boolean> {
  const deleted = await prisma.note.deleteMany({
    where: {
      id: noteId,
      userId,
    },
  });
  
  return deleted.count > 0;
}

export async function getAllNotes(): Promise<NoteRecord[]> {
  const notes = await prisma.note.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return notes.map(note => ({
    id: note.id,
    userId: note.userId,
    title: note.title,
    text: note.text,
    category: note.category as NoteCategory,
    createdAt: note.createdAt.getTime(),
  }));
}


