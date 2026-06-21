---
title: How This Site Works
date: 3309-06-21
created_at: 2026-06-21
modified_at: 2026-06-21
type: FIELD NOTE
excerpt: A tour of the small static build system behind this Frontier-styled personal site.
tags:
  - site
  - static
  - markdown
  - python
  - design
---
Flat Markdown files, a handful of HTML templates, one Python build script, no JavaScript package manager. The build is just large enough to behave like a real static site generator while staying readable in a single sitting.

## File Structure

```text
content/
  about/operator-profile.md
  posts/how-this-site-works.md
  projects/layout-calibration.md
templates/
  index.template.html
  detail.template.html
  collection.template.html
  tag.template.html
build.py
styles.css
script.js
```

Content lives under `content/`, split by type. Slugs come from filenames: `content/posts/how-this-site-works.md` becomes `/log/how-this-site-works/`, and `content/projects/layout-calibration.md` becomes `/projects/layout-calibration/`.

Each file has a YAML frontmatter block carrying display metadata — title, date, type, tags, and any type-specific fields like `system_name` or `repo_url`. The body is plain Markdown, supporting tables, fenced code, and standard article structure.

## The Build Script

`build.py` is the whole generator. In order:

1. loads `content/about/operator-profile.md` and builds the homepage about panel
2. loads all posts, sorts by date descending, collects tag references
3. loads all projects, sorts by manual `order` field, collects tag references
4. cleans previously generated directories
5. renders a detail page for every post and every project
6. renders the `/log/` and `/projects/` collection index pages
7. renders one tag index page per unique tag, plus `tag-index.json`
8. copies static assets into `dist/` when building for deployment

The core rendering loop is direct by design:

```python
for project in projects:
    render_content_page(project, "detail.template.html", output_path)

for post in posts:
    render_content_page(post, "detail.template.html", output_path)
```

There is no router. The generated file tree is the URL structure.

## Templates

All four templates share the same page chrome — status bars, nav, space canvas, CRT overlay — and differ only in their main content area. `detail.template.html` handles both posts and projects. `collection.template.html` handles both `/log/` and `/projects/`. Placeholder substitution is a plain string replace; no template engine dependency.

## Output Modes

Three `make` targets cover the main workflows:

| Target | What it does |
|---|---|
| `make build` | Writes generated pages into the repo root for direct inspection |
| `make dist` | Writes a clean GitHub Pages artifact into `dist/` |
| `make dev` | Builds `dist/`, serves locally, watches for changes, live-reloads |

Generated directories are wiped before each build, so a renamed Markdown file does not leave a stale route behind.

## Homepage Previews

The homepage surfaces:

- the 3 most recent posts, by date
- the first 3 projects, by manual `order` field
- links to the full `/log/` and `/projects/` indexes

Preview data is computed once during the build pass and injected into `index.template.html`. There is no client-side data fetching.

## Styling Pressure

The visual theme is Frontier: Elite II — VGA-era panel UI, CRT scanlines, a WebGL2 space scene. The content model exists partly to pressure-test that design across its full range of shapes:

- card titles, status badges, bylines, tag chips, stat blocks, and action links
- article metadata panels and long-form prose
- Markdown tables with translucent gradient backgrounds
- fenced code blocks with Pygments syntax token spans

The placeholder project at `/projects/layout-calibration/` exists solely to exercise those shapes before any real project article is complete.

## Checks

```bash
make check
```

Compiles the Python scripts, builds into a temporary directory, checks that expected routes exist, scans for unresolved template placeholders, and verifies that highlighted code blocks contain actual syntax token spans — not just a wrapper div around plain text.

## Why Keep It This Small?

The site could migrate to Eleventy, Astro, or Hugo. It will, if the content model grows enough to justify it. For now, the custom generator fits the site better than a framework would: the presentation requirements are unusual and the content model is tiny.

The rule is: add tooling when it removes real friction. Until then, opening `build.py` should explain the whole machine.
