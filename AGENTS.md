# Agent Instructions

## GitHub Identities
- **cbrunnkvist** — personal
- **CasualSecurityInc** — org for Nano/XNO ecosystem tools
- **OpenRai** — org for open standards and protocol primitives

## Project
Static personal site with a custom Python static site generator. No JS package manager.

## Commands
| Task | Command |
|------|---------|
| Build (local preview) | `make build` |
| Build (deploy artifact) | `make dist` |
| Dev server + watch | `make dev` |
| Run checks | `make check` |
| Clean generated output | `make clean` |

## Key Files
- `build.py` — full site generator (entry point for all content logic)
- `content/` — source Markdown files (canonical; do not edit generated output)
- `templates/` — HTML templates (detail, collection, tag, index)
- `styles.css` — all styles; Elite: Frontier II theme
- `script.js` — WebGL2 space scene, typing effect, nav canvas

## Key Conventions
- Generated dirs (`projects/`, `log/`, `tags/`, `dist/`) are wiped on each build; edit source in `content/` or `templates/`
- Python deps (`markdown`, `PyYAML`, `Pygments`) are inline script deps; run via `uv run build.py` locally, `pip install` in CI
- Content slugs come from filenames; renaming a file changes its URL on next build

## External References
| Need | File |
|------|------|
| Content authoring | `content/README.md` |
| CI / deploy | `.github/workflows/pages.yml` |
