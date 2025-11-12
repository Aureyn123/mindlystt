import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession, readUsers } from "@/lib/auth";
import {
  createShare,
  createShareGeneric,
  getSharesByNote,
  deleteShare,
  getSharesForUser,
  getSharesByOwner,
  createPublicShare,
  getPublicSharesByNote,
  deletePublicShare,
  type ShareType,
  type AnyShare,
  type NoteShare,
} from "@/lib/shares";

const COOKIE_NAME = "mindlyst_session";

function isNoteShare(share: AnyShare): share is NoteShare {
  return share.type === "note" || (!share.type && typeof (share as NoteShare).noteId === "string");
}

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
    const { type, shareType } = req.query as { type?: string; shareType?: ShareType };
    
    // Si type=owned, récupérer les partages créés par l'utilisateur
    if (type === "owned") {
      const shares = await getSharesByOwner(userId, shareType);
      return res.status(200).json({ shares });
    }
    
    // Sinon, récupérer les éléments partagés avec l'utilisateur
    const shares = await getSharesForUser(userId, shareType);
    return res.status(200).json({ shares });
  }

  if (req.method === "POST") {
    const { noteId, taskId, habitId, reminderId, sharedWithUsername, sharedWithEmail, permission, createPublicLink, shareType } = req.body as {
      noteId?: string;
      taskId?: string;
      habitId?: string;
      reminderId?: string;
      sharedWithUsername?: string;
      sharedWithEmail?: string; // Support rétrocompatibilité
      permission?: "read" | "write";
      createPublicLink?: boolean;
      shareType?: ShareType;
    };

    const itemId = noteId || taskId || habitId || reminderId;
    const type: ShareType = shareType || (noteId ? "note" : taskId ? "task" : habitId ? "habit" : "reminder");

    if (!itemId) {
      return res.status(400).json({ error: "ID de l'élément requis (noteId, taskId, habitId ou reminderId)" });
    }

    // Vérifier que l'utilisateur est propriétaire de l'élément
    const { readJson } = await import("@/lib/db");
    let item;
    if (type === "note") {
      const notes = await readJson<any[]>("notes.json", []);
      item = notes.find((n) => n.id === itemId);
    } else if (type === "task") {
      const tasks = await readJson<any[]>("tasks.json", []);
      item = tasks.find((t) => t.id === itemId);
    } else if (type === "habit") {
      const habits = await readJson<any[]>("habits.json", []);
      item = habits.find((h) => h.id === itemId);
    } else if (type === "reminder") {
      const reminders = await readJson<any[]>("reminders.json", []);
      item = reminders.find((r) => r.id === itemId);
    }
    
    if (!item || item.userId !== userId) {
      return res.status(403).json({ error: `Vous n'êtes pas propriétaire de cet élément` });
    }

    // Créer un lien public (uniquement pour les notes pour l'instant)
    if (createPublicLink) {
      if (type !== "note") {
        return res.status(400).json({ error: "Les liens publics ne sont disponibles que pour les notes" });
      }
      const publicShare = await createPublicShare(itemId, userId);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      return res.status(200).json({
        success: true,
        publicLink: `${baseUrl}/shared/${publicShare.shareToken}`,
        shareToken: publicShare.shareToken,
      });
    }

    // Partager avec un utilisateur spécifique (par pseudo ou email pour rétrocompatibilité)
    if (!sharedWithUsername && !sharedWithEmail) {
      return res.status(400).json({ error: "Pseudo ou email requis" });
    }

    const users = await readUsers();
    let sharedWithUser;
    if (sharedWithUsername) {
      // Rechercher par pseudo
      sharedWithUser = users.find((u) => u.username?.toLowerCase() === sharedWithUsername.toLowerCase().replace("@", ""));
    } else if (sharedWithEmail) {
      // Rechercher par email (rétrocompatibilité)
      sharedWithUser = users.find((u) => u.email === sharedWithEmail);
    }

    if (!sharedWithUser) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    if (sharedWithUser.id === userId) {
      return res.status(400).json({ error: "Vous ne pouvez pas partager avec vous-même" });
    }

    const share = await createShareGeneric(itemId, userId, sharedWithUser.id, type, permission || "read");
    return res.status(200).json({ success: true, share });
  }

  if (req.method === "DELETE") {
    const { shareId } = req.body as { shareId?: string };
    console.log("🗑️ API DELETE - shareId reçu:", shareId, "userId:", userId);
    
    if (!shareId) {
      return res.status(400).json({ error: "shareId requis" });
    }

    // Charger tous les partages pour trouver celui à supprimer
    const { loadShares } = await import("@/lib/shares");
    const allShares = await loadShares();
    console.log("📋 Total partages chargés:", allShares.length);
    const share = allShares.find((s) => s.id === shareId);
    
    if (!share) {
      console.error("❌ Partage non trouvé avec shareId:", shareId);
      console.log("📋 Partages disponibles:", allShares.map(s => s.id));
      return res.status(404).json({ error: "Partage non trouvé" });
    }

    if (isNoteShare(share)) {
      console.log("✅ Partage de note trouvé:", {
        id: share.id,
        noteId: share.noteId,
        ownerId: share.ownerId,
        sharedWithId: share.sharedWithId,
      });

      // Vérifier que l'utilisateur est propriétaire de la note ou le partage lui appartient
      const { readJson } = await import("@/lib/db");
      const notes = await readJson<any[]>("notes.json", []);
      const note = notes.find((n) => n.id === share.noteId);

      if (!note) {
        console.warn("⚠️ Note non trouvée:", share.noteId, "- Vérification des permissions sur le partage uniquement");
        const canDelete = share.ownerId === userId || share.sharedWithId === userId;

        if (!canDelete) {
          console.error(
            `❌ Permission refusée (note supprimée): userId=${userId}, share.ownerId=${share.ownerId}, share.sharedWithId=${share.sharedWithId}`
          );
          return res.status(403).json({ error: "Vous n'avez pas la permission de supprimer ce partage" });
        }

        await deleteShare(shareId);
        console.log("✅ Partage supprimé (note n'existe plus)");
        return res.status(200).json({ success: true, message: "Partage supprimé avec succès" });
      }

      console.log("📝 Note trouvée:", { id: note.id, userId: note.userId });

      const canDelete = note.userId === userId || share.sharedWithId === userId || share.ownerId === userId;

      console.log("🔐 Vérification permissions:", {
        canDelete,
        "note.userId === userId": note.userId === userId,
        "share.sharedWithId === userId": share.sharedWithId === userId,
        "share.ownerId === userId": share.ownerId === userId,
      });

      if (!canDelete) {
        console.error(
          `❌ Permission refusée: userId=${userId}, note.userId=${note.userId}, share.ownerId=${share.ownerId}, share.sharedWithId=${share.sharedWithId}`
        );
        return res.status(403).json({ error: "Vous n'avez pas la permission de supprimer ce partage" });
      }

      console.log("✅ Permission accordée, suppression du partage...");
      await deleteShare(shareId);
      console.log("✅ Partage supprimé avec succès");
      return res.status(200).json({ success: true, message: "Partage supprimé avec succès" });
    }

    // Pour les autres types (tâches, habitudes, rappels), autoriser la suppression si l'utilisateur est propriétaire ou destinataire
    const canDelete = share.ownerId === userId || share.sharedWithId === userId;
    if (!canDelete) {
      console.error(
        `❌ Permission refusée (partage non note): userId=${userId}, share.ownerId=${share.ownerId}, share.sharedWithId=${share.sharedWithId}`
      );
      return res.status(403).json({ error: "Vous n'avez pas la permission de supprimer ce partage" });
    }

    await deleteShare(shareId);
    console.log("✅ Partage non-note supprimé avec succès");
    return res.status(200).json({ success: true, message: "Partage supprimé avec succès" });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée" });
}

