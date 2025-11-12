import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { createOrUpdateSubscription, cancelSubscription } from "@/lib/subscription";
import { getRawBody } from "@/lib/stripe-webhook";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY non configuré");
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" }) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Stripe non configuré" });
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).json({ error: "Signature manquante" });
  }

  // Lire le body brut pour la vérification de signature
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Erreur de signature webhook:", err);
    return res.status(400).json({ error: `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = subscription.metadata.userId || session.metadata?.userId;
          
          if (userId) {
            await createOrUpdateSubscription(
              userId,
              "pro",
              subscription.customer as string,
              subscription.id
            );
            console.log(`✅ Abonnement Pro activé pour l'utilisateur ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        
        if (userId) {
          if (subscription.status === "active") {
            await createOrUpdateSubscription(
              userId,
              "pro",
              subscription.customer as string,
              subscription.id
            );
            console.log(`✅ Abonnement Pro mis à jour pour l'utilisateur ${userId}`);
          } else if (subscription.status === "canceled" || subscription.status === "past_due") {
            await cancelSubscription(userId);
            console.log(`❌ Abonnement annulé pour l'utilisateur ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        
        if (userId) {
          await cancelSubscription(userId);
          console.log(`❌ Abonnement supprimé pour l'utilisateur ${userId}`);
        }
        break;
      }

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erreur lors du traitement du webhook:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

// Désactiver le parsing JSON par défaut de Next.js pour les webhooks Stripe
export const config = {
  api: {
    bodyParser: false,
  },
};

