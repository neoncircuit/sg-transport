# GitHub About + Pages demo (one-time, `main` only)

No extra git branches — the demo is built from `main` by Actions.

## Why the workflow failed on `6c2621c`

The **frontend build succeeded**. Deploy failed at **Setup Pages** because
GitHub Pages was not enabled on the repository yet
(`GET /repos/.../pages` → 404).

## Fix (one minute)

1. Open https://github.com/neoncircuit/sg-transport/settings/pages  
2. Under **Build and deployment**, set **Source** to **GitHub Actions**  
3. **Actions → GitHub Pages demo → Run workflow**  
4. When green, open https://neoncircuit.github.io/sg-transport/

Allow up to a couple of minutes after the first successful deploy.

## Repo About sidebar (optional)

```bash
gh auth login
gh repo edit neoncircuit/sg-transport \
  --description "Real-time 2D map of Singapore transport — buses, MRT/LRT, planes & ships on MapLibre" \
  --homepage "https://neoncircuit.github.io/sg-transport/" \
  --add-topic singapore \
  --add-topic maplibre \
  --add-topic realtime \
  --add-topic transport \
  --add-topic typescript
```
