// Gestion des habitudes quotidiennes
import { prisma } from "./prisma";

export type HabitStatus = "completed" | "skipped" | "pending";

export type DailyHabitRecord = {
  date: string; // Format: YYYY-MM-DD
  status: HabitStatus;
  completedAt?: number; // Timestamp si complétée
};

export type Habit = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string; // Couleur optionnelle pour l'habitude
  dailyRecords: DailyHabitRecord[]; // Historique des jours
  createdAt: number;
  updatedAt: number;
};

// Obtenir la date du jour au format YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Obtenir la date d'hier
export function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
}

// Réinitialiser toutes les habitudes pour le nouveau jour
export async function resetDailyHabits(): Promise<void> {
  const habits = await prisma.habit.findMany({
    include: {
      dailyRecords: true,
    },
  });
  
  const today = getTodayDateString();
  
  for (const habit of habits) {
    // Vérifier si on a déjà un enregistrement pour aujourd'hui
    const todayRecord = habit.dailyRecords.find((r) => r.date === today);
    if (!todayRecord) {
      // Ajouter un enregistrement "pending" pour aujourd'hui
      await prisma.dailyHabitRecord.create({
        data: {
          habitId: habit.id,
          date: today,
          status: "pending",
        },
      });
    }
  }
}

export async function getUserHabits(userId: string): Promise<Habit[]> {
  const habits = await prisma.habit.findMany({
    where: { userId },
    include: {
      dailyRecords: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  
  const today = getTodayDateString();
  const habitsWithRecords: Habit[] = [];
  
  for (const habit of habits) {
    const todayRecord = habit.dailyRecords.find((r) => r.date === today);
    
    if (!todayRecord) {
      // Créer un enregistrement pour aujourd'hui
      await prisma.dailyHabitRecord.create({
        data: {
          habitId: habit.id,
          date: today,
          status: "pending",
        },
      });
      
      // Recharger l'habitude avec le nouveau record
      const updated = await prisma.habit.findUnique({
        where: { id: habit.id },
        include: {
          dailyRecords: {
            orderBy: { date: "desc" },
          },
        },
      });
      
      if (updated) {
        habitsWithRecords.push({
          id: updated.id,
          userId: updated.userId,
          name: updated.name,
          description: updated.description || undefined,
          color: updated.color || undefined,
          dailyRecords: updated.dailyRecords.map(record => ({
            date: record.date,
            status: record.status as HabitStatus,
            completedAt: record.completedAt ? record.completedAt.getTime() : undefined,
          })),
          createdAt: updated.createdAt.getTime(),
          updatedAt: updated.updatedAt.getTime(),
        });
      }
    } else {
      habitsWithRecords.push({
        id: habit.id,
        userId: habit.userId,
        name: habit.name,
        description: habit.description || undefined,
        color: habit.color || undefined,
        dailyRecords: habit.dailyRecords.map(record => ({
          date: record.date,
          status: record.status as HabitStatus,
          completedAt: record.completedAt ? record.completedAt.getTime() : undefined,
        })),
        createdAt: habit.createdAt.getTime(),
        updatedAt: habit.updatedAt.getTime(),
      });
    }
  }
  
  return habitsWithRecords;
}

export async function createHabit(userId: string, name: string, description?: string, color?: string): Promise<Habit> {
  const today = getTodayDateString();
  
  const habit = await prisma.habit.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "blue",
      dailyRecords: {
        create: {
          date: today,
          status: "pending",
        },
      },
    },
    include: {
      dailyRecords: {
        orderBy: { date: "desc" },
      },
    },
  });
  
  return {
    id: habit.id,
    userId: habit.userId,
    name: habit.name,
    description: habit.description || undefined,
    color: habit.color || undefined,
    dailyRecords: habit.dailyRecords.map(record => ({
      date: record.date,
      status: record.status as HabitStatus,
      completedAt: record.completedAt ? record.completedAt.getTime() : undefined,
    })),
    createdAt: habit.createdAt.getTime(),
    updatedAt: habit.updatedAt.getTime(),
  };
}

export async function updateHabitStatus(
  habitId: string,
  userId: string,
  date: string,
  status: HabitStatus
): Promise<Habit | null> {
  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId,
    },
  });
  
  if (!habit) {
    return null;
  }
  
  // Mettre à jour ou créer le record
  await prisma.dailyHabitRecord.upsert({
    where: {
      habitId_date: {
        habitId,
        date,
      },
    },
    update: {
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
    create: {
      habitId,
      date,
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
  });
  
  const updated = await prisma.habit.findUnique({
    where: { id: habitId },
    include: {
      dailyRecords: {
        orderBy: { date: "desc" },
      },
    },
  });
  
  if (!updated) return null;
  
  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    description: updated.description || undefined,
    color: updated.color || undefined,
    dailyRecords: updated.dailyRecords.map(record => ({
      date: record.date,
      status: record.status as HabitStatus,
      completedAt: record.completedAt ? record.completedAt.getTime() : undefined,
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function updateHabit(
  habitId: string,
  userId: string,
  updates: { name?: string; description?: string; color?: string }
): Promise<Habit | null> {
  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId,
    },
  });
  
  if (!habit) {
    return null;
  }
  
  const updated = await prisma.habit.update({
    where: { id: habitId },
    data: {
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.description !== undefined && { description: updates.description?.trim() || null }),
      ...(updates.color !== undefined && { color: updates.color }),
    },
    include: {
      dailyRecords: {
        orderBy: { date: "desc" },
      },
    },
  });
  
  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    description: updated.description || undefined,
    color: updated.color || undefined,
    dailyRecords: updated.dailyRecords.map(record => ({
      date: record.date,
      status: record.status as HabitStatus,
      completedAt: record.completedAt ? record.completedAt.getTime() : undefined,
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function deleteHabit(habitId: string, userId: string): Promise<boolean> {
  const deleted = await prisma.habit.deleteMany({
    where: {
      id: habitId,
      userId,
    },
  });
  
  return deleted.count > 0;
}

// Calculer le pourcentage de réussite pour une semaine
export function calculateWeeklySuccessRate(habit: Habit, weekStartDate?: Date): number {
  const start = weekStartDate || new Date();
  start.setDate(start.getDate() - start.getDay()); // Début de semaine (dimanche)
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Fin de semaine (samedi)
  end.setHours(23, 59, 59, 999);
  
  // Filtrer les enregistrements de la semaine
  const weekRecords = habit.dailyRecords.filter((record) => {
    const recordDate = new Date(record.date + "T00:00:00");
    return recordDate >= start && recordDate <= end;
  });
  
  if (weekRecords.length === 0) return 0;
  
  const completed = weekRecords.filter((r) => r.status === "completed").length;
  return Math.round((completed / weekRecords.length) * 100);
}

// Obtenir les statistiques de la semaine en cours
export function getWeeklyStats(habits: Habit[]): {
  totalHabits: number;
  averageSuccessRate: number;
  habitsStats: Array<{ habitId: string; habitName: string; successRate: number }>;
} {
  if (habits.length === 0) {
    return {
      totalHabits: 0,
      averageSuccessRate: 0,
      habitsStats: [],
    };
  }
  
  const habitsStats = habits.map((habit) => ({
    habitId: habit.id,
    habitName: habit.name,
    successRate: calculateWeeklySuccessRate(habit),
  }));
  
  const totalSuccessRate = habitsStats.reduce((sum, stat) => sum + stat.successRate, 0);
  const averageSuccessRate = Math.round(totalSuccessRate / habits.length);
  
  return {
    totalHabits: habits.length,
    averageSuccessRate,
    habitsStats,
  };
}
