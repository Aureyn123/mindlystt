// Gestion des tâches (todos)
import { prisma } from "./prisma";

export type TaskStatus = "pending" | "completed" | "cancelled";

export type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export type Task = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  subTasks: SubTask[]; // Liste des sous-tâches
  createdAt: number;
  updatedAt: number;
};

export async function getUserTasks(userId: string): Promise<Task[]> {
  const tasks = await prisma.task.findMany({
    where: { userId },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  
  return tasks.map(task => ({
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description || undefined,
    status: task.status as TaskStatus,
    subTasks: task.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
  }));
}

export async function createTask(
  userId: string,
  title: string,
  description?: string,
  subTasks?: string[]
): Promise<Task> {
  const task = await prisma.task.create({
    data: {
      userId,
      title: title.trim(),
      description: description?.trim() || null,
      status: "pending",
      subTasks: {
        create: subTasks
          ? subTasks.map((text) => ({
              text: text.trim(),
              completed: false,
            }))
          : [],
      },
    },
    include: {
      subTasks: true,
    },
  });
  
  return {
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description || undefined,
    status: task.status as TaskStatus,
    subTasks: task.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
  };
}

export async function updateTaskStatus(
  taskId: string,
  userId: string,
  status: TaskStatus
): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });
  
  if (!task) {
    return null;
  }
  
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function updateTask(
  taskId: string,
  userId: string,
  updates: { title?: string; description?: string }
): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });
  
  if (!task) {
    return null;
  }
  
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(updates.title !== undefined && { title: updates.title.trim() }),
      ...(updates.description !== undefined && { description: updates.description?.trim() || null }),
    },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function deleteTask(taskId: string, userId: string): Promise<boolean> {
  const deleted = await prisma.task.deleteMany({
    where: {
      id: taskId,
      userId,
    },
  });
  
  return deleted.count > 0;
}

export function calculateTaskCompletionRate(task: Task): number {
  if (task.subTasks.length === 0) {
    // Si pas de sous-tâches, utiliser le statut principal
    return task.status === "completed" ? 100 : 0;
  }
  const completedSubTasks = task.subTasks.filter((st) => st.completed).length;
  return Math.round((completedSubTasks / task.subTasks.length) * 100);
}

export function calculateCompletionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  
  // Calculer le pourcentage moyen basé sur les sous-tâches
  let totalPercentage = 0;
  for (const task of tasks) {
    totalPercentage += calculateTaskCompletionRate(task);
  }
  return Math.round(totalPercentage / tasks.length);
}

export async function addSubTask(taskId: string, userId: string, subTaskText: string): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      subTasks: true,
    },
  });
  
  if (!task) {
    return null;
  }
  
  const newSubTask = await prisma.subTask.create({
    data: {
      taskId,
      text: subTaskText.trim(),
      completed: false,
    },
  });
  
  // Mettre à jour le statut principal si toutes les sous-tâches sont complétées
  const allCompleted = task.subTasks.every((st) => st.completed) && newSubTask.completed;
  if (task.subTasks.length > 0 && allCompleted) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "completed" },
    });
  }
  
  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  if (!updated) return null;
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function toggleSubTask(taskId: string, userId: string, subTaskId: string): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      subTasks: true,
    },
  });
  
  if (!task) {
    return null;
  }
  
  const subTask = task.subTasks.find((st) => st.id === subTaskId);
  if (!subTask) {
    return null;
  }
  
  const updatedSubTask = await prisma.subTask.update({
    where: { id: subTaskId },
    data: { completed: !subTask.completed },
  });
  
  // Mettre à jour le statut principal
  const allSubTasks = task.subTasks.map(st => 
    st.id === subTaskId ? updatedSubTask : st
  );
  const allCompleted = allSubTasks.length > 0 && allSubTasks.every((st) => st.completed);
  
  if (allCompleted) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "completed" },
    });
  } else if (task.status === "completed") {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "pending" },
    });
  }
  
  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  if (!updated) return null;
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function deleteSubTask(taskId: string, userId: string, subTaskId: string): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      subTasks: true,
    },
  });
  
  if (!task) {
    return null;
  }
  
  await prisma.subTask.delete({
    where: { id: subTaskId },
  });
  
  // Mettre à jour le statut principal
  const remainingSubTasks = task.subTasks.filter((st) => st.id !== subTaskId);
  const allCompleted = remainingSubTasks.length > 0 && remainingSubTasks.every((st) => st.completed);
  
  if (allCompleted) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "completed" },
    });
  } else if (task.status === "completed" && remainingSubTasks.length > 0) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "pending" },
    });
  }
  
  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  if (!updated) return null;
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}

export async function updateSubTask(
  taskId: string,
  userId: string,
  subTaskId: string,
  newText: string
): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });
  
  if (!task) {
    return null;
  }
  
  await prisma.subTask.update({
    where: { id: subTaskId },
    data: { text: newText.trim() },
  });
  
  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  if (!updated) return null;
  
  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description || undefined,
    status: updated.status as TaskStatus,
    subTasks: updated.subTasks.map(st => ({
      id: st.id,
      text: st.text,
      completed: st.completed,
      createdAt: st.createdAt.getTime(),
    })),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };
}
