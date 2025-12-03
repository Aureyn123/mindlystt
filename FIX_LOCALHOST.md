# 🔧 Réparation du localhost - Solution rapide

Le problème vient du fait que Prisma n'est pas encore configuré. Voici 2 solutions :

## 🚀 Solution 1 : Configuration rapide avec SQLite (pour tester maintenant)

Cette solution permet de tester localement avec SQLite avant de passer à Supabase.

### Étape 1 : Modifier le schéma Prisma pour SQLite

Modifiez `prisma/schema.prisma` pour utiliser SQLite temporairement :

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### Étape 2 : Installer et générer Prisma

```bash
npm install
npx prisma generate
npx prisma db push
```

### Étape 3 : Tester

```bash
npm run dev
```

---

## 🔧 Solution 2 : Configuration Supabase (recommandé)

### Étape 1 : Créer un compte Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet

### Étape 2 : Récupérer la DATABASE_URL

1. Dans votre projet Supabase, allez dans **Settings** > **Database**
2. Faites défiler jusqu'à **Connection string** > **URI**
3. Copiez la chaîne qui ressemble à :
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

### Étape 3 : Créer le fichier .env.local

Créez un fichier `.env.local` à la racine avec :

```env
DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
```

**Remplacez** :
- `VOTRE_MOT_DE_PASSE` par le mot de passe de votre projet Supabase
- `xxxxx` par l'ID de votre projet

### Étape 4 : Générer Prisma et créer les tables

```bash
npx prisma generate
npx prisma db push
```

### Étape 5 : Tester

```bash
npm run dev
```

---

## ❌ Si ça ne fonctionne toujours pas

Vérifiez :

1. **Le fichier .env.local existe-t-il ?**
   ```bash
   ls -la .env.local
   ```

2. **Les dépendances sont-elles installées ?**
   ```bash
   npm install
   ```

3. **Le client Prisma est-il généré ?**
   ```bash
   npx prisma generate
   ```

4. **Vérifiez les erreurs dans le terminal**
   Regardez les messages d'erreur lors de `npm run dev`

---

## 🔄 Revenir aux fichiers JSON (solution temporaire)

Si vous voulez temporairement revenir aux fichiers JSON pour tester, vous pouvez :

1. Ne pas utiliser Prisma pour l'instant
2. Garder `lib/db.ts` qui utilise les fichiers JSON
3. Mais cela nécessiterait de revenir en arrière sur certaines modifications

**Je recommande plutôt d'utiliser la Solution 1 (SQLite) pour tester rapidement !**


