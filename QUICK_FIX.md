# ⚡ Solution rapide pour réparer localhost

## 🔴 Le problème
L'application ne démarre plus car Prisma a besoin de :
1. Une base de données configurée (DATABASE_URL)
2. Le client Prisma généré

## ✅ Solution en 3 étapes (5 minutes)

### Option A : Utiliser Supabase (gratuit, recommandé)

#### 1. Créer un compte Supabase (2 min)
1. Allez sur https://supabase.com
2. Cliquez sur "Start your project"
3. Connectez-vous avec GitHub
4. Cliquez sur "New Project"
5. Choisissez :
   - **Name** : `mindlyst-dev`
   - **Database Password** : créez un mot de passe (notez-le !)
   - **Region** : choisissez la plus proche
6. Cliquez sur "Create new project"
7. Attendez 2-3 minutes que le projet soit créé

#### 2. Récupérer la DATABASE_URL (1 min)
1. Dans votre projet Supabase, cliquez sur ⚙️ **Settings** (en bas à gauche)
2. Cliquez sur **Database**
3. Faites défiler jusqu'à **Connection string**
4. Cliquez sur l'onglet **URI**
5. Copiez la chaîne qui ressemble à :
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. Remplacez `[YOUR-PASSWORD]` par le mot de passe que vous avez créé
7. Ajoutez à la fin : `?pgbouncer=true&connection_limit=1`

**Exemple final :**
```
postgresql://postgres.xxxxx:monMotDePasse123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

#### 3. Créer .env.local et configurer (2 min)

Créez un fichier `.env.local` à la racine du projet avec :

```env
DATABASE_URL="COLLEZ_ICI_VOTRE_DATABASE_URL"
```

Puis exécutez :

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

🎉 **Votre application devrait fonctionner !**

---

### Option B : Utiliser SQLite (plus rapide, mais limité)

Si vous voulez tester sans créer de compte Supabase :

1. **Modifiez** `prisma/schema.prisma` :
   - Changez `provider = "postgresql"` par `provider = "sqlite"`
   - Changez `url = env("DATABASE_URL")` par `url = "file:./dev.db"`

2. **Générez et poussez** :
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```

⚠️ **Note** : SQLite ne supporte pas toutes les fonctionnalités. Pour la production, utilisez Supabase.

---

## 🆘 Si ça ne marche toujours pas

Exécutez ces commandes et envoyez-moi les erreurs :

```bash
npm install
npx prisma generate
npm run dev
```

Copiez-collez les erreurs qui s'affichent dans le terminal.


