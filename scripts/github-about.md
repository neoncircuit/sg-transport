# GitHub About + Pages demo (one-time, `main` only)

No extra git branches — the demo is built from `main` by Actions.

## 1. Enable Pages (fixes the 404)

The first deploy failed because Pages was not enabled yet. Build succeeded;
only deploy failed.

1. Open https://github.com/neoncircuit/sg-transport/settings/pages
2. **Build and deployment → Source** → **GitHub Actions**
3. **Actions → GitHub Pages demo → Run workflow** (or push any frontend change)
4. When green, open https://neoncircuit.github.io/sg-transport/

Allow a minute after the first successful deploy for the site to appear.

## 2. Repo About sidebar

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
