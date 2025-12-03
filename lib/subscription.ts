// Gestion des abonnements pour le SaaS
import { prisma } from "./prisma";
import { PLAN_LIMITS, type SubscriptionPlan, type SubscriptionLimits } from "./subscription-plans";

export { PLAN_LIMITS, SubscriptionPlan, SubscriptionLimits };

export type UserSubscription = {
  userId: string;
  plan: SubscriptionPlan;
  startDate: number;
  endDate: number | null; // null = actif indéfiniment (abonnement récurrent)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: "active" | "canceled" | "past_due" | "trialing";
};

export async function loadSubscriptions(): Promise<UserSubscription[]> {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return subscriptions.map(sub => ({
    userId: sub.userId,
    plan: sub.plan as SubscriptionPlan,
    startDate: sub.startDate.getTime(),
    endDate: sub.endDate ? sub.endDate.getTime() : null,
    stripeCustomerId: sub.stripeCustomerId || undefined,
    stripeSubscriptionId: sub.stripeSubscriptionId || undefined,
    status: sub.status as "active" | "canceled" | "past_due" | "trialing",
  }));
}

export async function saveSubscriptions(subscriptions: UserSubscription[]): Promise<void> {
  // Cette fonction n'est plus vraiment utilisée mais on la garde pour compatibilité
  for (const sub of subscriptions) {
    await prisma.subscription.upsert({
      where: { userId: sub.userId },
      update: {
        plan: sub.plan,
        startDate: new Date(sub.startDate),
        endDate: sub.endDate ? new Date(sub.endDate) : null,
        stripeCustomerId: sub.stripeCustomerId || null,
        stripeSubscriptionId: sub.stripeSubscriptionId || null,
        status: sub.status,
      },
      create: {
        userId: sub.userId,
        plan: sub.plan,
        startDate: new Date(sub.startDate),
        endDate: sub.endDate ? new Date(sub.endDate) : null,
        stripeCustomerId: sub.stripeCustomerId || null,
        stripeSubscriptionId: sub.stripeSubscriptionId || null,
        status: sub.status,
      },
    });
  }
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });
  
  if (!subscription || subscription.status !== "active") {
    return null;
  }
  
  return {
    userId: subscription.userId,
    plan: subscription.plan as SubscriptionPlan,
    startDate: subscription.startDate.getTime(),
    endDate: subscription.endDate ? subscription.endDate.getTime() : null,
    stripeCustomerId: subscription.stripeCustomerId || undefined,
    stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
    status: subscription.status as "active" | "canceled" | "past_due" | "trialing",
  };
}

export async function createOrUpdateSubscription(
  userId: string,
  plan: SubscriptionPlan,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<UserSubscription> {
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      startDate: new Date(),
      endDate: null, // Actif indéfiniment
      stripeCustomerId: stripeCustomerId || undefined,
      stripeSubscriptionId: stripeSubscriptionId || undefined,
      status: "active",
    },
    create: {
      userId,
      plan,
      startDate: new Date(),
      endDate: null, // Actif indéfiniment
      stripeCustomerId: stripeCustomerId || undefined,
      stripeSubscriptionId: stripeSubscriptionId || undefined,
      status: "active",
    },
  });
  
  return {
    userId: subscription.userId,
    plan: subscription.plan as SubscriptionPlan,
    startDate: subscription.startDate.getTime(),
    endDate: subscription.endDate ? subscription.endDate.getTime() : null,
    stripeCustomerId: subscription.stripeCustomerId || undefined,
    stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
    status: subscription.status as "active" | "canceled" | "past_due" | "trialing",
  };
}

export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: { status: "canceled" },
  });
}

export async function getRemainingRemindersThisMonth(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return PLAN_LIMITS.free.maxRemindersPerMonth;
  }

  const limit = PLAN_LIMITS[subscription.plan].maxRemindersPerMonth;
  if (limit === -1) return Infinity; // Illimité

  // Compter les rappels envoyés ce mois-ci
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      sent: true,
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  });

  const sentThisMonth = reminders.length;

  return Math.max(0, limit - sentThisMonth);
}

export async function canCreateReminder(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const remaining = await getRemainingRemindersThisMonth(userId);
  if (remaining <= 0) {
    return {
      allowed: false,
      reason: "Vous avez atteint la limite de rappels pour ce mois. Passez à un plan supérieur pour plus de rappels.",
    };
  }
  return { allowed: true };
}

export async function canCreateNote(userId: string): Promise<{ allowed: boolean; reason?: string; remainingToday?: number }> {
  // Vérifier si l'utilisateur est admin (bypass des limites)
  const { isUserAdmin } = await import("./admin");
  const isAdmin = await isUserAdmin(userId);
  if (isAdmin) {
    return { allowed: true, remainingToday: Infinity };
  }

  const subscription = await getUserSubscription(userId);
  const plan = subscription?.plan || "free";
  const limit = PLAN_LIMITS[plan].maxNotesPerDay;

  // Compter les notes créées aujourd'hui
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const notesToday = await prisma.note.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  const remaining = limit - notesToday;

  if (notesToday >= limit) {
    return {
      allowed: false,
      remainingToday: 0,
      reason: `Vous avez atteint votre limite de ${limit} note(s) par jour. ${plan === "free" ? "Passez au plan Pro (9€/mois) pour 10 notes par jour !" : "Votre limite sera réinitialisée demain."}`,
    };
  }

  return { allowed: true, remainingToday: remaining };
}

export async function getNotesCreatedToday(userId: string): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return await prisma.note.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
      },
    },
  });
}
