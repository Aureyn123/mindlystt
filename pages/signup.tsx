import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password })
      });
      if (!response.ok) {
        const raw = await response.text();
        let message = "Erreur inattendue";
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { error?: string; message?: string };
            message = parsed.message ?? parsed.error ?? message;
          } catch {
            message = raw;
          }
        }
        throw new Error(message || "Erreur inattendue");
      }
      await response.json().catch(() => null);
      await router.push("/login?signup=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-block p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-2">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Créer un compte</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Commence à organiser tes idées en quelques secondes</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pseudo
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              maxLength={20}
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              placeholder="Choisis un pseudo unique"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">3-20 caractères. Ce pseudo sera visible par tes contacts.</p>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">8 caractères minimum.</p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white py-3 font-semibold transition shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="text-slate-900 dark:text-slate-300 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}

