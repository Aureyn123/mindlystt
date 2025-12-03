# ⚡ Installation rapide - Corriger l'erreur

## 🔴 L'erreur actuelle

```
Module not found: Can't resolve '@prisma/client'
```

## ✅ Solution en 2 étapes

### Étape 1 : Installer les dépendances

Ouvrez un terminal dans votre projet et exécutez :

```bash
npm install
```

⏳ Attendez que l'installation soit terminée (1-2 minutes).

### Étape 2 : Générer le client Prisma

Une fois l'installation terminée, exécutez :

```bash
npx prisma generate
```

⏳ Attendez que la génération soit terminée (30 secondes).

### Étape 3 : Créer la base de données

Puis :

```bash
npx prisma db push
```

### Étape 4 : Démarrer l'application

```bash
npm run dev
```

🎉 **Ça devrait fonctionner maintenant !**

---

## 📝 Résumé des commandes

Exécutez ces commandes **dans l'ordre** :

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

---

## ⚠️ Note importante

J'ai configuré le schéma pour utiliser **SQLite** temporairement (base de données locale dans un fichier).

- ✅ **Avantage** : Ça fonctionne immédiatement, pas besoin de configurer Supabase
- ⚠️ **Limitation** : SQLite est pour le développement local uniquement

Pour la production ou pour accéder depuis votre téléphone, vous devrez utiliser **Supabase** (voir `REPARER_LOCALHOST.md`).

---

## 🆘 Si ça ne fonctionne toujours pas

Envoyez-moi les erreurs qui s'affichent dans le terminal après avoir exécuté les commandes.


