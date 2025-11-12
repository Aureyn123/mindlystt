import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { parseCookies, getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/subscription-plans";

type PricingProps = {
  userPlan: "free" | "pro" | null;
};

const COOKIE_NAME = "mindlyst_session";

export default function PricingPage({ userPlan }: PricingProps) {
  return (
    <>
      <Head>
        <title>Tarifs · MindLyst</title>
      </Head>
      <main className="min-h-screen bg-slate-50 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Choisissez votre plan</h1>
            <p className="text-lg text-slate-600">Des tarifs simples et transparents</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plan Free */}
            <div className={`bg-white rounded-lg border-2 ${userPlan === "free" ? "border-blue-500" : "border-slate-200"} p-8 shadow-sm`}>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Gratuit</h2>
                <div className="text-4xl font-bold text-slate-900 mb-1">0€</div>
                <p className="text-sm text-slate-500">par mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{PLAN_LIMITS.free.maxNotesPerDay} note(s) par jour</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{PLAN_LIMITS.free.maxRemindersPerMonth} rappels par mois</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Catégories et filtres</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Modification et suppression</span>
                </li>
              </ul>
              {userPlan === "free" ? (
                <button
                  disabled
                  className="w-full rounded-md bg-slate-200 text-slate-600 px-6 py-3 font-medium cursor-not-allowed"
                >
                  Plan actuel
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="block w-full text-center rounded-md border-2 border-slate-300 text-slate-700 px-6 py-3 font-medium hover:bg-slate-50 transition"
                >
                  Revenir au dashboard
                </Link>
              )}
            </div>

            {/* Plan Pro */}
            <div className={`bg-white rounded-lg border-2 ${userPlan === "pro" ? "border-blue-500" : "border-blue-200"} p-8 shadow-lg relative`}>
              {userPlan !== "pro" && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommandé
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Pro</h2>
                <div className="text-4xl font-bold text-slate-900 mb-1">{PLAN_LIMITS.pro.price}€</div>
                <p className="text-sm text-slate-500">par mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="font-medium">{PLAN_LIMITS.pro.maxNotesPerDay} notes par jour</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="font-medium">{PLAN_LIMITS.pro.maxRemindersPerMonth} rappels par mois</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Toutes les fonctionnalités gratuites</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Export des notes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Support prioritaire</span>
                </li>
              </ul>
              {userPlan === "pro" ? (
                <button
                  disabled
                  className="w-full rounded-md bg-slate-200 text-slate-600 px-6 py-3 font-medium cursor-not-allowed"
                >
                  Plan actuel
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/subscription/create-checkout", {
                        method: "POST",
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        alert(error.error || "Erreur lors de la création du checkout");
                        return;
                      }
                      const { url } = await response.json();
                      if (url) {
                        window.location.href = url;
                      }
                    } catch (error) {
                      console.error("Erreur:", error);
                      alert("Erreur lors de la redirection vers le paiement");
                    }
                  }}
                  className="w-full rounded-md bg-blue-600 text-white px-6 py-3 font-medium hover:bg-blue-700 transition"
                >
                  Passer à Pro
                </button>
              )}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 hover:underline"
            >
              ← Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PricingProps> = async (context) => {
  const cookies = parseCookies({ headers: { cookie: context.req.headers.cookie } });
  const token = cookies[COOKIE_NAME];
  
  let userPlan: "free" | "pro" | null = null;
  
  if (token) {
    const session = await getSession(token);
    if (session) {
      const { getUserSubscription } = await import("@/lib/subscription");
      const subscription = await getUserSubscription(session.userId);
      userPlan = subscription?.plan || "free";
    }
  }

  return {
    props: {
      userPlan,
    },
  };
};

