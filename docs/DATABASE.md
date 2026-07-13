# Base de données — Connexion & maintenance

La base est hébergée sur **Supabase** (PostgreSQL). Le code Next.js s’y connecte via `@supabase/supabase-js`. Le schéma est versionné dans `supabase/migrations/`.

---

## Pourquoi ne plus copier-coller du SQL

Les collages manuels dans l’éditeur Supabase provoquent souvent :

- migrations appliquées **deux fois** (doublons, contraintes en conflit)
- numéros de migration **désynchronisés** entre GitHub et la base distante
- policies RLS **partiellement** appliquées
- « bulles » : données orphelines ou tables créées hors historique

**Solution :** une migration = un fichier `.sql` dans Git → `npm run db:push`.

---

## Configuration initiale (une fois)

### 1. Installer la CLI Supabase

```powershell
npm install   # supabase est déjà dans devDependencies
npx supabase login
```

### 2. Lier le projet local à Supabase

Dans le dashboard Supabase → **Project Settings → General → Reference ID**.

```powershell
cd C:\Users\USER\chantier-app
npx supabase link --project-ref VOTRE_REF_PROJET
```

### 3. Fichier `.env.local`

Copier `.env.example` vers `.env.local` et remplir :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (côté serveur uniquement, jamais exposé au navigateur)

### 4. Appliquer les migrations

```powershell
npm run db:push
```

Vérifier l’état :

```powershell
npm run db:status
```

---

## Connecter la base à Cursor (pour que l’agent travaille directement)

Trois méthodes, de la plus simple à la plus intégrée :

### Méthode A — Supabase CLI (recommandée, déjà dans le projet)

L’agent peut exécuter des requêtes via le terminal :

```powershell
npx supabase db execute --file ma-requete.sql
# ou requête inline :
npx supabase db execute "SELECT count(*) FROM projects;"
```

Prérequis : `supabase link` fait une fois. Pas de copier-coller manuel.

### Méthode B — MCP PostgreSQL dans Cursor

Permet à l’agent de lire/écrire en SQL directement dans le chat.

1. Supabase → **Project Settings → Database → Connection string → URI**
2. Choisir **Session mode** ou **Transaction mode**
3. Remplacer `[YOUR-PASSWORD]` par le mot de passe base
4. Dans Cursor : **Settings → MCP → Add server**

Exemple de config MCP (serveur Postgres) :

```json
{
  "mcpServers": {
    "supabase-db": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres.[ref]:[MOT_DE_PASSE]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
      ]
    }
  }
}
```

Utiliser l’URL exacte de votre projet Supabase. **Ne pas committer** cette config avec le mot de passe — la garder dans les paramètres utilisateur Cursor.

Après activation, dites simplement : *« interroge la base via MCP »* et l’agent pourra lister les tables, vérifier les doublons, nettoyer les données.

### Méthode C — Dashboard Supabase (humain seulement)

**SQL Editor** dans le dashboard reste utile pour inspection rapide, mais pour les **modifications de schéma**, toujours créer une migration Git.

---

## Créer une nouvelle migration

```powershell
npx supabase migration new ma_modification
```

Éditer le fichier généré dans `supabase/migrations/`, puis :

```powershell
npm run db:push
git add supabase/migrations/
git commit -m "db: description de la modification"
git push
```

Numérotation : utiliser le numéro **suivant** (voir `supabase/migrations/README.md`). Un seul fichier par numéro.

---

## Réparer une base déjà « polluée » par des collages manuels

### Étape 1 — Inventaire

Dans le SQL Editor Supabase :

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

Comparer avec les fichiers locaux (`npm run db:status`).

### Étape 2 — Schéma vs migrations

Si des tables existent mais la migration n’est pas enregistrée :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('013_incoming_files', '013_incoming_files')
ON CONFLICT DO NOTHING;
```

Adapter `version` au **nom de fichier** (sans `.sql`).

### Étape 3 — Nettoyage données (exemples)

```sql
-- Doublons incoming_files (même file_name + project_id)
SELECT file_name, project_id, count(*)
FROM incoming_files
GROUP BY file_name, project_id
HAVING count(*) > 1;

-- Lister les policies RLS manquantes
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
);
```

Demandez à l’agent (avec MCP ou CLI) d’exécuter ces diagnostics — pas besoin de copier les résultats à la main.

### Étape 4 — Réinitialisation complète (dev uniquement)

⚠️ **Efface toutes les données.**

```powershell
npx supabase db reset --linked
```

Puis `npm run db:push` pour repartir d’un schéma propre.

---

## Push GitHub après chaque modification

```powershell
git add .
git commit -m "description claire"
git push origin main
```

Si GitHub Actions ou Vercel sont branchés, le déploiement app suivra le push ; la base suit via `db:push` séparément (ou CI dédiée).

---

## Résumé

| Action | Commande / outil |
|--------|------------------|
| Appliquer migrations | `npm run db:push` |
| État migrations | `npm run db:status` |
| Requête ad hoc | `npx supabase db execute "..."` |
| Agent Cursor direct | MCP Postgres + URI Supabase |
| Nouveau changement schéma | `npx supabase migration new ...` |
| **À éviter** | Copier-coller SQL dans le dashboard |
