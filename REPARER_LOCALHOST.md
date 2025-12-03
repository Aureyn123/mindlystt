# 🔧 Réparer localhost - Guide étape par étape

Votre application ne démarre plus car Prisma n'est pas configuré. Voici comment réparer ça en **5 minutes** :

---

## 🎯 Solution recommandée : Supabase (gratuit)

### Étape 1 : Créer un projet Supabase (2 minutes)

1. Allez sur **https://supabase.com**
2. Cliquez sur **"Start your project"** (gratuit)
3. Connectez-vous avec GitHub ou email
4. Cliquez sur **"New Project"**
5. Remplissez :
   - **Name** : `mindlyst-test`
   - **Database Password** : créez un mot de passe (notez-le !)
   - **Region** : choisissez la région la plus proche
6. Cliquez sur **"Create new project"**
7. ⏳ Attendez 2-3 minutes

### Étape 2 : Récupérer la DATABASE_URL (1 minute)

1. Dans votre projet Supabase, cliquez sur ⚙️ **Settings** (icône en bas à gauche)
2. Cliquez sur **Database** dans le menu
3. Faites défiler jusqu'à la section **"Connection string"**
4. Cliquez sur l'onglet **"URI"**
5. Vous verrez quelque chose comme :
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. **Copiez cette chaîne**
7. **Remplacez** `[YOUR-PASSWORD]` par le mot de passe que vous avez créé à l'étape 1
8. **Ajoutez à la fin** : `?pgbouncer=true&connection_limit=1`

**Exemple de ce que vous devriez avoir :**
```
postgresql://postgres.xxxxx:monMotDePasse123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Étape 3 : Créer le fichier .env.local (1 minute)

1. **Créez un fichier** nommé `.env.local` à la racine de votre projet
2. **Ajoutez cette ligne** (remplacez par votre vraie URL) :
   ```
   DATABASE_URL="postgresql://postgres.xxxxx:VOTRE_MOT_DE_PASSE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   ```

### Étape 4 : Installer et configurer (1 minute)

Ouvrez un terminal dans votre projet et exécutez :

```bash
npm install
npx prisma generate
npx prisma db push
```

### Étape 5 : Tester

```bash
npm run dev
```

Ouvrez **http://localhost:3000** dans votre navigateur ! 🎉

---

## ⚡ Solution alternative : SQLite (si vous voulez tester sans Supabase)

Si vous voulez tester rapidement sans créer de compte :

1. **Ouvrez** le fichier `prisma/schema.prisma`
2. **Trouvez** ces lignes :
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. **Remplacez** par :
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```
4. **Exécutez** :
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```

⚠️ **Attention** : SQLite est limité. Pour la production, utilisez Supabase.

---

## ❌ Si ça ne fonctionne toujours pas

Vérifiez :

1. **Le fichier .env.local existe-t-il ?**
   - Il doit être à la racine du projet
   - Il doit contenir `DATABASE_URL="..."`

2. **Avez-vous exécuté toutes les commandes ?**
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   ```

3. **Vérifiez les erreurs dans le terminal**
   - Copiez-collez les erreurs qui apparaissent
   - Regardez s'il y a des erreurs de connexion à la base de données

4. **Vérifiez que la DATABASE_URL est correcte**
   - Pas d'espaces avant/après
   - Le mot de passe est bien remplacé
   - Les guillemets sont présents

---

## 📞 Besoin d'aide ?

Si ça ne fonctionne toujours pas, envoyez-moi :
1. Les erreurs du terminal lors de `npm run dev`
2. Le contenu de votre fichier `.env.local` (sans le mot de passe !)
3. Le résultat de `npx prisma db push`

---

## ✅ Résumé rapide

1. Créer un compte Supabase (gratuit) → https://supabase.com
2. Créer un projet
3. Copier la DATABASE_URL
4. Créer `.env.local` avec la DATABASE_URL
5. Exécuter : `npm install && npx prisma generate && npx prisma db push`
6. Lancer : `npm run dev`

**C'est tout ! 🚀**


