import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession } from "@/lib/auth";
import { getUserNotes, createNote, type NoteCategory, type NoteRecord } from "@/lib/notes";
import type { NoteShare } from "@/lib/shares";

const COOKIE_NAME = "mindlyst_session";
const ALLOWED_CATEGORIES: NoteCategory[] = ["business", "perso", "sport", "clients", "urgent", "autres"];

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

  if (req.method === "GET") {
    const userNotes = await getUserNotes(userId);
    
    // Inclure les notes partagées avec l'utilisateur
    const { getSharesForUser } = await import("@/lib/shares");
    const { getAllNotes } = await import("@/lib/notes");
    const shares = await getSharesForUser(userId);
    const noteShares = shares.filter((share): share is NoteShare => {
      if (share.type === "note" || !share.type) {
        return typeof (share as NoteShare).noteId === "string";
      }
      return false;
    });
    const sharedNoteIds = new Set(noteShares.map(s => s.noteId));
    const allNotesFromDb = await getAllNotes();
    const sharedNotes = allNotesFromDb.filter(note => sharedNoteIds.has(note.id));
    
    const allNotes = [...userNotes, ...sharedNotes].sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ notes: allNotes });
  }

  if (req.method === "POST") {
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

    // Vérifier la limite quotidienne
    const { canCreateNote } = await import("@/lib/subscription");
    const check = await canCreateNote(userId);
    if (!check.allowed) {
      return res.status(403).json({ 
        error: check.reason,
        remainingToday: check.remainingToday,
        limitReached: true
      });
    }

    const newNote = await createNote(userId, title, text, category);

    // Détecter les dates dans la note et créer des événements si des intégrations sont actives
    // Uniquement pour les dates "pour bientôt" (dans les 7 prochains jours)
    try {
      const { detectDatesInText } = await import("@/lib/integrations");
      const { getIntegration } = await import("@/lib/integrations");
      
      const dates = detectDatesInText(`${title} ${text}`);
      if (dates.length > 0) {
        // Vérifier les intégrations actives
        const googleIntegration = await getIntegration(userId, "google_calendar");
        
        if (googleIntegration) {
          // Créer un événement uniquement pour les dates "pour bientôt" (dans les 7 prochains jours)
          const firstDate = dates[0];
          const now = new Date();
          const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours
          
          // Vérifier que la date est dans le futur et dans les 7 prochains jours
          if (firstDate.date > now && firstDate.date <= sevenDaysFromNow) {
            const endDate = new Date(firstDate.date);
            endDate.setHours(endDate.getHours() + 1); // Durée par défaut : 1 heure
            
            // Créer l'événement directement
            try {
              const { createGoogleCalendarEvent } = await import("@/lib/google-calendar");
              const result = await createGoogleCalendarEvent(
                userId,
                title,
                text,
                firstDate.date.toISOString(),
                endDate.toISOString()
              );
              
              if (result.success) {
                console.log("✅ Événement créé dans Google Calendar (date pour bientôt)");
              } else {
                console.error("❌ Erreur:", result.error);
              }
            } catch (err) {
              console.error("Erreur lors de la création de l'événement:", err);
            }
          } else {
            console.log("ℹ️ Date détectée mais trop éloignée (>7 jours) - événement non créé");
          }
        }
      }
    } catch (err) {
      // Ne pas faire échouer la création de note si l'intégration échoue
      console.error("Erreur lors de l'intégration:", err);
    }

    return res.status(201).json({ note: newNote, remainingToday: check.remainingToday ? check.remainingToday - 1 : undefined });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Méthode non autorisée" });
}

