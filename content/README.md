# Content System

This site is generated from flat files.

- `content/about/operator-profile.md` feeds the homepage operator profile.
- `content/projects/*.md` feeds the Ship Systems grid and generates `projects/<slug>/`.
- `content/posts/*.md` feeds Latest Intel, Mission Log, and generates `log/<slug>/`.
- `tags` are cross-cutting discovery metadata and generate `tags/<tag>/` plus `tag-index.json`.

Local authoring commands:

```bash
make build
make dev
```

`make build` generates local root output for direct file preview. `make dev`
builds the GitHub Pages-style `dist/` artifact, serves it at
`http://localhost:8000/`, watches source files, rebuilds on change, and reloads
the browser.

Markdown files can be edited directly or through the Front Matter CMS VS Code extension.

GitHub Pages deployment is handled by `.github/workflows/pages.yml`. Edits made
through GitHub's built-in editor on `main` trigger the workflow, which builds the
site into `dist/` and deploys that artifact. Generated directories are ignored in
Git because `content/`, `templates/`, and static assets are the canonical source.
