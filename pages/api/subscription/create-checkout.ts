import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookies, getSession } from "@/lib/auth";
import Stripe from "stripe";

const COOKIE_NAME = "mindlyst_session";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO; // ID du prix Pro dans Stripe

if (!STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY non configuré");
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" }) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (!stripe) {
    return res.status(500).json({ error: "Stripe non configuré" });
  }

  if (!STRIPE_PRICE_ID_PRO) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID_PRO non configuré" });
  }

  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const session = await getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Session expirée" });
  }

  try {
    // Créer ou récupérer le client Stripe
    const { readUsers } = await import("@/lib/auth");
    const users = await readUsers();
    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const { getUserSubscription } = await import("@/lib/subscription");
    const existingSubscription = await getUserSubscription(session.userId);
    if (existingSubscription?.plan === "pro") {
      return res.status(400).json({ error: "Vous avez déjà un abonnement Pro actif" });
    }

    // Créer une session Checkout Stripe
    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PRICE_ID_PRO,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.origin || "http://localhost:3000"}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || "http://localhost:3000"}/pricing?canceled=true`,
      metadata: {
        userId: session.userId,
      },
      subscription_data: {
        metadata: {
          userId: session.userId,
        },
      },
    });

    return res.status(200).json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    console.error("Erreur lors de la création du checkout Stripe:", error);
    return res.status(500).json({ error: "Erreur lors de la création du checkout" });
  }
}

