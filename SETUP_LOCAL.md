# 🚀 Configuration rapide pour tester en local

## Solution la plus simple : Utiliser SQLite temporairement

### Étape 1 : Modifier le schéma Prisma

Je vais modifier le schéma pour utiliser SQLite en développement. Suivez ces étapes :

1. **Ouvrez** `prisma/schema.prisma`
2. **Remplacez** la ligne `provider = "postgresql"` par `provider = "sqlite"`
3. **Remplacez** la ligne `url = env("DATABASE_URL")` par `url = "file:./dev.db"`

Ou exécutez cette commande :

```bash
# Sur macOS/Linux
sed -i '' 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
sed -i '' 's|url      = env("DATABASE_URL")|url      = "file:./dev.db"|' prisma/schema.prisma
```

### Étape 2 : Installer et générer

```bash
npm install
npx prisma generate
npx prisma db push
```

### Étape 3 : Tester

```bash
npm run dev
```

Votre application devrait fonctionner sur http://localhost:3000 !

---

## Plus tard : Passer à Supabase

Quand vous serez prêt, vous pourrez :
1. Créer un projet Supabase
2. Récupérer la DATABASE_URL
3. Créer un fichier `.env.local`
4. Remettre `provider = "postgresql"` dans le schéma
5. Relancer `npx prisma db push`

Mais pour l'instant, SQLite suffit pour tester ! 🎉


