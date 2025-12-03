// Gestion du partage de notes
import { prisma } from "./prisma";

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

export async function loadShares(): Promise<AnyShare[]> {
  const shares = await prisma.share.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => {
    const baseShare = {
      id: share.id,
      ownerId: share.ownerId,
      sharedWithId: share.sharedWithId,
      permission: share.permission as "read" | "write",
      createdAt: share.createdAt.getTime(),
      type: share.type as ShareType,
    };
    
    if (share.type === "note" && share.noteId) {
      return { ...baseShare, noteId: share.noteId } as NoteShare;
    } else if (share.type === "task" && share.taskId) {
      return { ...baseShare, taskId: share.taskId } as TaskShare;
    } else if (share.type === "habit" && share.habitId) {
      return { ...baseShare, habitId: share.habitId } as HabitShare;
    } else if (share.type === "reminder" && share.reminderId) {
      return { ...baseShare, reminderId: share.reminderId } as ReminderShare;
    }
    
    // Par défaut, considérer comme NoteShare pour rétrocompatibilité
    return { ...baseShare, noteId: share.noteId || "", type: "note" } as NoteShare;
  });
}

export async function saveShares(shares: AnyShare[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée mais on la garde pour compatibilité
  // Supprimer tous les partages existants et les recréer
  await prisma.share.deleteMany({});
  
  for (const share of shares) {
    await prisma.share.create({
      data: {
        id: share.id,
        ownerId: share.ownerId,
        sharedWithId: share.sharedWithId,
        permission: share.permission,
        type: share.type || "note",
        noteId: "noteId" in share ? share.noteId : null,
        taskId: "taskId" in share ? share.taskId : null,
        habitId: "habitId" in share ? share.habitId : null,
        reminderId: "reminderId" in share ? share.reminderId : null,
      },
    });
  }
}

export async function loadPublicShares(): Promise<PublicShare[]> {
  const publicShares = await prisma.publicShare.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return publicShares.map(share => ({
    id: share.id,
    noteId: share.noteId,
    ownerId: share.ownerId,
    shareToken: share.shareToken,
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt ? share.expiresAt.getTime() : undefined,
  }));
}

export async function savePublicShares(shares: PublicShare[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée mais on la garde pour compatibilité
  await prisma.publicShare.deleteMany({});
  
  for (const share of shares) {
    await prisma.publicShare.create({
      data: {
        id: share.id,
        noteId: share.noteId,
        ownerId: share.ownerId,
        shareToken: share.shareToken,
        expiresAt: share.expiresAt ? new Date(share.expiresAt) : null,
      },
    });
  }
}

// Fonction générique pour créer un partage
export async function createShareGeneric(
  itemId: string,
  ownerId: string,
  sharedWithId: string,
  type: ShareType,
  permission: "read" | "write" = "read"
): Promise<AnyShare> {
  // Vérifier si le partage existe déjà
  const whereClause: any = {
    ownerId,
    sharedWithId,
    type,
  };
  
  if (type === "note") {
    whereClause.noteId = itemId;
  } else if (type === "task") {
    whereClause.taskId = itemId;
  } else if (type === "habit") {
    whereClause.habitId = itemId;
  } else if (type === "reminder") {
    whereClause.reminderId = itemId;
  }
  
  const existing = await prisma.share.findFirst({
    where: whereClause,
  });
  
  if (existing) {
    const updated = await prisma.share.update({
      where: { id: existing.id },
      data: { permission },
    });
    
    return {
      id: updated.id,
      ownerId: updated.ownerId,
      sharedWithId: updated.sharedWithId,
      permission: updated.permission as "read" | "write",
      createdAt: updated.createdAt.getTime(),
      type: updated.type as ShareType,
      ...(type === "note" && { noteId: updated.noteId || "" }),
      ...(type === "task" && { taskId: updated.taskId || "" }),
      ...(type === "habit" && { habitId: updated.habitId || "" }),
      ...(type === "reminder" && { reminderId: updated.reminderId || "" }),
    } as AnyShare;
  }

  const data: any = {
    ownerId,
    sharedWithId,
    permission,
    type,
  };
  
  if (type === "note") {
    data.noteId = itemId;
  } else if (type === "task") {
    data.taskId = itemId;
  } else if (type === "habit") {
    data.habitId = itemId;
  } else if (type === "reminder") {
    data.reminderId = itemId;
  }
  
  const share = await prisma.share.create({ data });
  
  const result = {
    id: share.id,
    ownerId: share.ownerId,
    sharedWithId: share.sharedWithId,
    permission: share.permission as "read" | "write",
    createdAt: share.createdAt.getTime(),
    type: share.type as ShareType,
  };
  
  if (type === "note") {
    return { ...result, noteId: share.noteId || "" } as NoteShare;
  } else if (type === "task") {
    return { ...result, taskId: share.taskId || "" } as TaskShare;
  } else if (type === "habit") {
    return { ...result, habitId: share.habitId || "" } as HabitShare;
  } else {
    return { ...result, reminderId: share.reminderId || "" } as ReminderShare;
  }
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
  await prisma.share.delete({
    where: { id: shareId },
  });
}

export async function getSharesForUser(userId: string, type?: ShareType): Promise<AnyShare[]> {
  const where: any = { sharedWithId: userId };
  if (type) {
    where.type = type;
  }
  
  const shares = await prisma.share.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => {
    const baseShare = {
      id: share.id,
      ownerId: share.ownerId,
      sharedWithId: share.sharedWithId,
      permission: share.permission as "read" | "write",
      createdAt: share.createdAt.getTime(),
      type: share.type as ShareType,
    };
    
    if (share.type === "note" && share.noteId) {
      return { ...baseShare, noteId: share.noteId } as NoteShare;
    } else if (share.type === "task" && share.taskId) {
      return { ...baseShare, taskId: share.taskId } as TaskShare;
    } else if (share.type === "habit" && share.habitId) {
      return { ...baseShare, habitId: share.habitId } as HabitShare;
    } else if (share.type === "reminder" && share.reminderId) {
      return { ...baseShare, reminderId: share.reminderId } as ReminderShare;
    }
    
    return { ...baseShare, noteId: share.noteId || "", type: "note" } as NoteShare;
  });
}

export async function getSharesByOwner(ownerId: string, type?: ShareType): Promise<AnyShare[]> {
  const where: any = { ownerId };
  if (type) {
    where.type = type;
  }
  
  const shares = await prisma.share.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => {
    const baseShare = {
      id: share.id,
      ownerId: share.ownerId,
      sharedWithId: share.sharedWithId,
      permission: share.permission as "read" | "write",
      createdAt: share.createdAt.getTime(),
      type: share.type as ShareType,
    };
    
    if (share.type === "note" && share.noteId) {
      return { ...baseShare, noteId: share.noteId } as NoteShare;
    } else if (share.type === "task" && share.taskId) {
      return { ...baseShare, taskId: share.taskId } as TaskShare;
    } else if (share.type === "habit" && share.habitId) {
      return { ...baseShare, habitId: share.habitId } as HabitShare;
    } else if (share.type === "reminder" && share.reminderId) {
      return { ...baseShare, reminderId: share.reminderId } as ReminderShare;
    }
    
    return { ...baseShare, noteId: share.noteId || "", type: "note" } as NoteShare;
  });
}

export async function getSharesByNote(noteId: string): Promise<AnyShare[]> {
  const shares = await prisma.share.findMany({
    where: {
      noteId,
      type: "note",
    },
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => ({
    id: share.id,
    noteId: share.noteId || "",
    ownerId: share.ownerId,
    sharedWithId: share.sharedWithId,
    permission: share.permission as "read" | "write",
    createdAt: share.createdAt.getTime(),
    type: "note" as ShareType,
  })) as NoteShare[];
}

export async function getSharesByTask(taskId: string): Promise<TaskShare[]> {
  const shares = await prisma.share.findMany({
    where: {
      taskId,
      type: "task",
    },
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => ({
    id: share.id,
    taskId: share.taskId || "",
    ownerId: share.ownerId,
    sharedWithId: share.sharedWithId,
    permission: share.permission as "read" | "write",
    createdAt: share.createdAt.getTime(),
    type: "task" as ShareType,
  })) as TaskShare[];
}

export async function getSharesByHabit(habitId: string): Promise<HabitShare[]> {
  const shares = await prisma.share.findMany({
    where: {
      habitId,
      type: "habit",
    },
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => ({
    id: share.id,
    habitId: share.habitId || "",
    ownerId: share.ownerId,
    sharedWithId: share.sharedWithId,
    permission: share.permission as "read" | "write",
    createdAt: share.createdAt.getTime(),
    type: "habit" as ShareType,
  })) as HabitShare[];
}

export async function getSharesByReminder(reminderId: string): Promise<ReminderShare[]> {
  const shares = await prisma.share.findMany({
    where: {
      reminderId,
      type: "reminder",
    },
    orderBy: { createdAt: "desc" },
  });
  
  return shares.map(share => ({
    id: share.id,
    reminderId: share.reminderId || "",
    ownerId: share.ownerId,
    sharedWithId: share.sharedWithId,
    permission: share.permission as "read" | "write",
    createdAt: share.createdAt.getTime(),
    type: "reminder" as ShareType,
  })) as ReminderShare[];
}

function isNoteShare(s: any): s is NoteShare {
  return s.type === "note" && typeof s.noteId === "string" && typeof s.sharedWithId === "string";
}

export async function canUserAccessNote(
  userId: string,
  noteId: string
): Promise<{ canAccess: boolean; permission?: "read" | "write" }> {
  const share = await prisma.share.findFirst({
    where: {
      noteId,
      sharedWithId: userId,
      type: "note",
    },
  });

  if (share) {
    return { canAccess: true, permission: share.permission as "read" | "write" };
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
  // Vérifier si un partage public existe déjà pour cette note
  const existing = await prisma.publicShare.findFirst({
    where: {
      noteId,
      ownerId,
    },
  });
  
  if (existing) {
    return {
      id: existing.id,
      noteId: existing.noteId,
      ownerId: existing.ownerId,
      shareToken: existing.shareToken,
      createdAt: existing.createdAt.getTime(),
      expiresAt: existing.expiresAt ? existing.expiresAt.getTime() : undefined,
    };
  }

  const share = await prisma.publicShare.create({
    data: {
      noteId,
      ownerId,
      shareToken: generateShareToken(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
    },
  });
  
  return {
    id: share.id,
    noteId: share.noteId,
    ownerId: share.ownerId,
    shareToken: share.shareToken,
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt ? share.expiresAt.getTime() : undefined,
  };
}

export async function getPublicShareByToken(token: string): Promise<PublicShare | null> {
  const share = await prisma.publicShare.findUnique({
    where: { shareToken: token },
  });
  
  if (!share) return null;
  
  // Vérifier l'expiration
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return null;
  }
  
  return {
    id: share.id,
    noteId: share.noteId,
    ownerId: share.ownerId,
    shareToken: share.shareToken,
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt ? share.expiresAt.getTime() : undefined,
  };
}

export async function deletePublicShare(shareId: string): Promise<void> {
  await prisma.publicShare.delete({
    where: { id: shareId },
  });
}

export async function getPublicSharesByNote(noteId: string): Promise<PublicShare[]> {
  const publicShares = await prisma.publicShare.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
  });
  
  return publicShares.map(share => ({
    id: share.id,
    noteId: share.noteId,
    ownerId: share.ownerId,
    shareToken: share.shareToken,
    createdAt: share.createdAt.getTime(),
    expiresAt: share.expiresAt ? share.expiresAt.getTime() : undefined,
  }));
}
