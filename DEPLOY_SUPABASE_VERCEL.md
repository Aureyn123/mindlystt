# Guide de déploiement : Supabase + Vercel

Ce guide explique comment configurer et déployer votre application Mindlyst avec Supabase (PostgreSQL) sur Vercel.

## 📋 Prérequis

- Un compte [Supabase](https://supabase.com)
- Un compte [Vercel](https://vercel.com)
- Un compte GitHub (pour le déploiement automatique)

---

## 🔧 Étape 1 : Configuration Supabase

### 1.1 Créer un projet Supabase

1. Connectez-vous à [Supabase Dashboard](https://app.supabase.com)
2. Cliquez sur **"New Project"**
3. Remplissez les informations :
   - **Name** : `mindlyst` (ou votre nom de projet)
   - **Database Password** : Créez un mot de passe fort (notez-le quelque part)
   - **Region** : Choisissez la région la plus proche
4. Cliquez sur **"Create new project"** et attendez la création (2-3 minutes)

### 1.2 Récupérer la chaîne de connexion DATABASE_URL

1. Dans votre projet Supabase, allez dans **Settings** (⚙️) > **Database**
2. Faites défiler jusqu'à la section **"Connection string"**
3. Cliquez sur l'onglet **"URI"**
4. Copiez la chaîne qui ressemble à :
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. Remplacez `[YOUR-PASSWORD]` par le mot de passe que vous avez créé à l'étape 1.1
6. **Ajoutez les paramètres suivants à la fin** pour optimiser la connexion :
   ```
   ?pgbouncer=true&connection_limit=1
   ```
   
   **Exemple final** :
   ```
   postgresql://postgres:monMotDePasse123@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
   ```

### 1.3 Appliquer le schéma Prisma à Supabase

1. **Installer Prisma** (si pas déjà fait) :
   ```bash
   npm install
   ```

2. **Créer le fichier `.env.local`** à la racine du projet :
   ```bash
   DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
   ```
   > ⚠️ **Remplacez** `VOTRE_MOT_DE_PASSE` et `xxxxx` par vos vraies valeurs de l'étape 1.2

3. **Générer le client Prisma** :
   ```bash
   npx prisma generate
   ```

4. **Pousser le schéma vers Supabase** :
   ```bash
   npx prisma db push
   ```
   
   Cette commande va créer toutes les tables dans votre base Supabase.

5. **Vérifier les tables** (optionnel) :
   ```bash
   npx prisma studio
   ```
   Cela ouvre une interface graphique pour voir vos tables.

---

## 🚀 Étape 2 : Déploiement sur Vercel

### 2.1 Préparer le projet

1. **Vérifier que tout fonctionne en local** :
   ```bash
   npm run build
   npm run dev
   ```

2. **Pousser le code sur GitHub** :
   ```bash
   git add .
   git commit -m "Migration vers Supabase + Prisma"
   git push origin main
   ```

### 2.2 Connecter le projet à Vercel

1. Connectez-vous à [Vercel Dashboard](https://vercel.com/dashboard)
2. Cliquez sur **"Add New..."** > **"Project"**
3. Importez votre repository GitHub
4. Vercel détectera automatiquement Next.js

### 2.3 Configurer les variables d'environnement

1. Dans la page de configuration du projet Vercel, allez dans **"Environment Variables"**
2. Ajoutez les variables suivantes :

   | Variable | Valeur | Exemple |
   |----------|--------|---------|
   | `DATABASE_URL` | Votre chaîne de connexion Supabase | `postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1` |
   | `NEXT_PUBLIC_API_URL` | URL de votre app Vercel (sera `https://votre-app.vercel.app`) | `https://mindlyst.vercel.app` |
   
   > ⚠️ **Important** : Remplacez `NEXT_PUBLIC_API_URL` par l'URL que Vercel vous donnera après le déploiement, ou laissez-le vide pour utiliser l'URL automatique.

3. Si vous utilisez Stripe, ajoutez également :
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`

4. Cliquez sur **"Deploy"**

### 2.4 Vérifier le déploiement

1. Attendez que le build se termine (2-5 minutes)
2. Vercel vous donnera une URL comme : `https://votre-app.vercel.app`
3. Testez l'application :
   - Créez un compte
   - Créez une note
   - Vérifiez que tout fonctionne

---

## 📱 Étape 3 : Accéder depuis votre téléphone

Une fois déployé sur Vercel, votre application sera accessible depuis n'importe où :

1. **Depuis votre téléphone**, ouvrez votre navigateur
2. Allez sur l'URL Vercel : `https://votre-app.vercel.app`
3. Vous pouvez créer un raccourci sur l'écran d'accueil (ajouter à l'écran d'accueil)

---

## 🔄 Étape 4 : Migrer les données existantes (optionnel)

Si vous aviez des données dans les fichiers JSON locaux, vous pouvez les migrer :

1. **Exporter les données JSON** depuis le dossier `data/`
2. **Créer un script de migration** (exemple dans `scripts/migrate-json-to-prisma.ts`)
3. **Exécuter le script** :
   ```bash
   npx ts-node scripts/migrate-json-to-prisma.ts
   ```

> 💡 **Note** : Si vous avez beaucoup de données, il est recommandé de créer un script personnalisé.

---

## 🛠️ Commandes utiles

### En développement local

```bash
# Générer le client Prisma
npx prisma generate

# Synchroniser le schéma avec la base de données
npx prisma db push

# Ouvrir Prisma Studio (interface graphique)
npx prisma studio

# Créer une migration (si vous modifiez le schéma)
npx prisma migrate dev --name nom_de_la_migration

# Voir les migrations
npx prisma migrate status
```

### En production (Vercel)

Les migrations se font automatiquement lors du déploiement si vous utilisez `prisma migrate deploy` dans votre script de build, ou manuellement via :

```bash
npx prisma migrate deploy
```

---

## ⚠️ Dépannage

### Erreur : "Can't reach database server"

- Vérifiez que `DATABASE_URL` est correct dans Vercel
- Vérifiez que votre projet Supabase est actif
- Assurez-vous que le mot de passe est correct dans la chaîne de connexion

### Erreur : "Relation does not exist"

- Exécutez `npx prisma db push` pour créer les tables
- Vérifiez que le schéma Prisma est à jour

### Erreur lors du build sur Vercel

- Vérifiez que toutes les variables d'environnement sont définies
- Vérifiez les logs de build dans Vercel Dashboard
- Assurez-vous que `DATABASE_URL` est bien défini

### Les données ne s'affichent pas

- Vérifiez la connexion à Supabase avec `npx prisma studio`
- Vérifiez les logs de l'application dans Vercel
- Testez les routes API directement

---

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation Vercel](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## ✅ Checklist finale

- [ ] Projet Supabase créé
- [ ] `DATABASE_URL` récupérée et ajoutée dans `.env.local`
- [ ] Schéma Prisma poussé vers Supabase (`npx prisma db push`)
- [ ] Application testée en local (`npm run build` et `npm run dev`)
- [ ] Code poussé sur GitHub
- [ ] Projet connecté à Vercel
- [ ] Variables d'environnement configurées sur Vercel
- [ ] Déploiement réussi
- [ ] Application accessible depuis le téléphone

---

**🎉 Félicitations ! Votre application est maintenant déployée et accessible depuis n'importe où !**


