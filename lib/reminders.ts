import { prisma } from "./prisma";

export type Reminder = {
  id: string;
  noteId: string;
  userId: string;
  userEmail: string;
  noteTitle: string;
  noteText: string;
  reminderDate: number; // timestamp
  sent: boolean;
  createdAt: number;
};

export async function loadReminders(): Promise<Reminder[]> {
  const reminders = await prisma.reminder.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return reminders.map(reminder => ({
    id: reminder.id,
    noteId: reminder.noteId,
    userId: reminder.userId,
    userEmail: reminder.userEmail,
    noteTitle: reminder.noteTitle,
    noteText: reminder.noteText,
    reminderDate: reminder.reminderDate.getTime(),
    sent: reminder.sent,
    createdAt: reminder.createdAt.getTime(),
  }));
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée mais on la garde pour compatibilité
  for (const reminder of reminders) {
    await prisma.reminder.upsert({
      where: { id: reminder.id },
      update: {
        noteId: reminder.noteId,
        userId: reminder.userId,
        userEmail: reminder.userEmail,
        noteTitle: reminder.noteTitle,
        noteText: reminder.noteText,
        reminderDate: new Date(reminder.reminderDate),
        sent: reminder.sent,
      },
      create: {
        id: reminder.id,
        noteId: reminder.noteId,
        userId: reminder.userId,
        userEmail: reminder.userEmail,
        noteTitle: reminder.noteTitle,
        noteText: reminder.noteText,
        reminderDate: new Date(reminder.reminderDate),
        sent: reminder.sent,
      },
    });
  }
}

export async function createReminder(reminder: Omit<Reminder, "id" | "createdAt" | "sent">): Promise<Reminder> {
  const newReminder = await prisma.reminder.create({
    data: {
      noteId: reminder.noteId,
      userId: reminder.userId,
      userEmail: reminder.userEmail,
      noteTitle: reminder.noteTitle,
      noteText: reminder.noteText,
      reminderDate: new Date(reminder.reminderDate),
      sent: false,
    },
  });
  
  return {
    id: newReminder.id,
    noteId: newReminder.noteId,
    userId: newReminder.userId,
    userEmail: newReminder.userEmail,
    noteTitle: newReminder.noteTitle,
    noteText: newReminder.noteText,
    reminderDate: newReminder.reminderDate.getTime(),
    sent: newReminder.sent,
    createdAt: newReminder.createdAt.getTime(),
  };
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date();
  const reminders = await prisma.reminder.findMany({
    where: {
      sent: false,
      reminderDate: { lte: now },
    },
    orderBy: { reminderDate: "asc" },
  });
  
  return reminders.map(reminder => ({
    id: reminder.id,
    noteId: reminder.noteId,
    userId: reminder.userId,
    userEmail: reminder.userEmail,
    noteTitle: reminder.noteTitle,
    noteText: reminder.noteText,
    reminderDate: reminder.reminderDate.getTime(),
    sent: reminder.sent,
    createdAt: reminder.createdAt.getTime(),
  }));
}

export async function markReminderAsSent(reminderId: string): Promise<void> {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { sent: true },
  });
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await prisma.reminder.delete({
    where: { id: reminderId },
  });
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      sent: false,
    },
    orderBy: { reminderDate: "asc" },
  });
  
  return reminders.map(reminder => ({
    id: reminder.id,
    noteId: reminder.noteId,
    userId: reminder.userId,
    userEmail: reminder.userEmail,
    noteTitle: reminder.noteTitle,
    noteText: reminder.noteText,
    reminderDate: reminder.reminderDate.getTime(),
    sent: reminder.sent,
    createdAt: reminder.createdAt.getTime(),
  }));
}
