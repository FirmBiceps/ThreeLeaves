# Three Leaves ERP

A modular React + Vite version of the ERP dashboard, ready for GitHub and Netlify deployment.

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the schema in [supabase/schema.sql](/Users/junming/Documents/New%20project/supabase/schema.sql).
3. Copy [.env.example](/Users/junming/Documents/New%20project/.env.example) to `.env.local`.
4. Fill in:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Restart `npm run dev`.

How this app stores data:
- The ERP saves one full app snapshot into the `app_state` table.
- If Supabase is not configured, the app falls back to demo in-memory data.
- Once Supabase is configured, edits automatically sync to Supabase.

## Push to GitHub

1. Create a new empty GitHub repository.
2. In this project folder, run:

```bash
git add .
git commit -m "Set up modular Three Leaves ERP"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

If `origin` already exists, replace the remote command with:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
```

## Deploy to Netlify

1. Log in to Netlify.
2. Click `Add new site` -> `Import an existing project`.
3. Choose `GitHub` and select your repository.
4. Use these settings:

```text
Base directory: (leave blank)
Build command: npm run build
Publish directory: dist
```

5. Click `Deploy site`.

## Notes

- `node_modules`, `dist`, and the local zip archive are ignored and should not be committed.
- This project uses `netlify.toml`, so Netlify can also pick up the build settings automatically.

## Project structure

```text
src/
  components/
    auth/
    layout/
    shared/
  data/
  features/
    billing/
    customers/
    dashboard/
    gst/
    inventory/
    invoices/
    logistics/
    picking/
    suppliers/
    team/
  hooks/
  utils/
```
# ThreeLeaves
# ThreeLeaves
