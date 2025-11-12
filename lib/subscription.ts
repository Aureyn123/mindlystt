// Gestion des abonnements pour le SaaS
import { readJson, writeJson } from "./db";
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

const SUBSCRIPTIONS_FILE = "subscriptions.json";

export async function loadSubscriptions(): Promise<UserSubscription[]> {
  return readJson<UserSubscription[]>(SUBSCRIPTIONS_FILE, []);
}

export async function saveSubscriptions(subscriptions: UserSubscription[]): Promise<void> {
  await writeJson(SUBSCRIPTIONS_FILE, subscriptions);
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const subscriptions = await loadSubscriptions();
  const subscription = subscriptions.find((s) => s.userId === userId && s.status === "active");
  return subscription || null;
}

export async function createOrUpdateSubscription(
  userId: string,
  plan: SubscriptionPlan,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<UserSubscription> {
  const subscriptions = await loadSubscriptions();
  const existing = subscriptions.find((s) => s.userId === userId);

  const newSubscription: UserSubscription = {
    userId,
    plan,
    startDate: Date.now(),
    endDate: null, // Actif indéfiniment (peut être modifié selon votre logique)
    stripeCustomerId,
    stripeSubscriptionId,
    status: "active",
  };

  if (existing) {
    const index = subscriptions.indexOf(existing);
    subscriptions[index] = { ...existing, ...newSubscription };
  } else {
    subscriptions.push(newSubscription);
  }

  await saveSubscriptions(subscriptions);
  return newSubscription;
}

export async function cancelSubscription(userId: string): Promise<void> {
  const subscriptions = await loadSubscriptions();
  const subscription = subscriptions.find((s) => s.userId === userId);
  if (subscription) {
    subscription.status = "canceled";
    await saveSubscriptions(subscriptions);
  }
}

export async function getRemainingRemindersThisMonth(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return PLAN_LIMITS.free.maxRemindersPerMonth;
  }

  const limit = PLAN_LIMITS[subscription.plan].maxRemindersPerMonth;
  if (limit === -1) return Infinity; // Illimité

  // Compter les rappels envoyés ce mois-ci
  const { loadReminders } = await import("./reminders");
  const reminders = await loadReminders();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const sentThisMonth = reminders.filter(
    (r) => r.userId === userId && r.sent && r.createdAt >= startOfMonth
  ).length;

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
  const { readJson } = await import("./db");
  const notes = await readJson<any[]>("notes.json", []);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const notesToday = notes.filter(
    (n) => n.userId === userId && n.createdAt >= startOfDay
  ).length;

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
  const { readJson } = await import("./db");
  const notes = await readJson<any[]>("notes.json", []);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  return notes.filter(
    (n) => n.userId === userId && n.createdAt >= startOfDay
  ).length;
}

