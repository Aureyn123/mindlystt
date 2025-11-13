import type { NextApiRequest, NextApiResponse } from "next";
import {
  createSession,
  deleteSession,
  parseCookies,
  readUsers,
  verifyPassword
} from "@/lib/auth";

type LoginBody = {
  email?: string;
  password?: string;
};

const COOKIE_NAME = "mindlyst_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json");
    return res.status(405).json({ success: false, message: "Méthode non autorisée" });
  }

  try {
    res.setHeader("Content-Type", "application/json");
    const { email, password } = req.body as LoginBody;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email et mot de passe requis" });
    }

    const users = await readUsers();
    if (!Array.isArray(users)) {
      console.error("readUsers ne renvoie pas un tableau", users);
      return res.status(500).json({ success: false, message: "Erreur interne : base utilisateurs invalide" });
    }

    const user = users.find((u) => u.email === email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ success: false, message: "Utilisateur introuvable" });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Mot de passe incorrect" });
    }

    const cookies = parseCookies(req);
    const existingToken = cookies[COOKIE_NAME];
    if (existingToken) {
      await deleteSession(existingToken);
    }

    const session = await createSession(user.id);
    const cookieParts = [
      `${COOKIE_NAME}=${session.token}`,
      "HttpOnly",
      "Path=/",
      `Max-Age=${MAX_AGE_SECONDS}`,
      "SameSite=Lax"
    ];
    if (process.env.NODE_ENV === "production") {
      cookieParts.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));

    const { passwordHash, ...safeUser } = user;
    return res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Erreur lors du login:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return res.status(500).json({ success: false, message });
  }
}

