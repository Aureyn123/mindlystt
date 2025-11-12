export type SubscriptionPlan = "free" | "pro";

export type SubscriptionLimits = {
  maxNotesPerDay: number;
  maxRemindersPerMonth: number;
  price: number;
  features: string[];
};

export const PLAN_LIMITS: Record<SubscriptionPlan, SubscriptionLimits> = {
  free: {
    maxNotesPerDay: 2,
    maxRemindersPerMonth: 5,
    price: 0,
    features: ["notes", "catégories", "filtres", "rappels"],
  },
  pro: {
    maxNotesPerDay: 10,
    maxRemindersPerMonth: 100,
    price: 9,
    features: ["notes", "catégories", "filtres", "rappels", "export"],
  },
};


