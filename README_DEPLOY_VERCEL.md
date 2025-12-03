---

# 🚀 Déploiement du projet Next.js + Prisma sur Vercel

Ce guide explique TOUT ce qu'il faut faire pour déployer proprement ce projet sur Vercel, étape par étape.

---

# 1. Préparer le projet

Ce projet utilise :

- Next.js

- Prisma

- Une base SQLite en local (dev)

- Une base Postgres distante (Supabase) en production

- Des intégrations OAuth Google Calendar

- SMTP iCloud pour envoyer des emails

⚠️ SQLite **ne fonctionne pas** sur Vercel (système de fichiers en lecture seule).  
➡️ En production, **Prisma utilisera uniquement `DATABASE_URL` (Supabase/Postgres)**.

---

# 2. Variables d'environnement nécessaires

Voici toutes les variables trouvées dans `.env.local`, avec leur rôle :

## Variables SMTP (secrètes)

| Name | Description |
|------|-------------|
| SMTP_HOST | Serveur SMTP iCloud |
| SMTP_PORT | Port SMTP |
| SMTP_USER | Identifiant SMTP |
| SMTP_PASSWORD | Mot de passe d'application iCloud |
| SMTP_FROM | Expéditeur utilisé pour les emails |

## Variables Google OAuth (secrètes)

| Name | Description |
|------|-------------|
| GOOGLE_CLIENT_ID | OAuth Google |
| GOOGLE_CLIENT_SECRET | Secret OAuth Google |
| GOOGLE_REDIRECT_URI | URL de callback OAuth |

## Variables globales

| Name | Description |
|------|-------------|
| NEXT_PUBLIC_BASE_URL | URL publique du site |
| DATABASE_URL | Connexion Postgres (production) |

---

# 3. Déployer sur Vercel (pas à pas)

## Étape 1 — Se connecter

1. Aller sur https://vercel.com  
2. Se connecter avec GitHub

## Étape 2 — Importer le projet

1. Cliquer **New Project**

2. Sélectionner le repo GitHub contenant ce projet

3. Laisser la configuration par défaut :

   - Framework detected: **Next.js**

   - Build command: `next build`

   - Output directory: `.vercel/output` (automatique)

## Étape 3 — Ajouter les variables d'environnement dans Vercel

Aller dans **Settings → Environment Variables** et ajouter TOUTES les variables suivantes :

### 📌 Variables à mettre dans **Production**, **Preview** et **Development**

| Name | Value (ce que tu dois coller) |
|------|-------------------------------|
| SMTP_HOST | smtp.mail.me.com |
| SMTP_PORT | 587 |
| SMTP_USER | lennydecourtieux@icloud.com |
| SMTP_PASSWORD | Ton mot de passe d'application iCloud |
| SMTP_FROM | noreply@mindlyst.com |
| GOOGLE_CLIENT_ID | La valeur obtenue dans Google Cloud |
| GOOGLE_CLIENT_SECRET | La valeur obtenue dans Google Cloud |
| GOOGLE_REDIRECT_URI | https://mon-projet.vercel.app/api/integrations/google-calendar/callback |
| NEXT_PUBLIC_BASE_URL | https://mon-projet.vercel.app |
| DATABASE_URL | La connexion Postgres Supabase |

➡️ Bien cocher les trois environments :  
✔ Production  
✔ Preview  
✔ Development

---

# 4. Après le premier déploiement

Une URL sera générée automatiquement, par ex :
