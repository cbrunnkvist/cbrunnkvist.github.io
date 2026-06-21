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
This site is intentionally small: flat Markdown files, a handful of HTML templates, one Python build script, and no JavaScript package manager. The interesting part is not that it avoids a framework. The interesting part is that the build is now just large enough to behave like a real static site generator while staying easy to inspect.

## Source of Truth

The canonical content lives under `content/`.

```text
content/
  about/
    operator-profile.md
  posts/
    how-this-site-works.md
  projects/
    layout-calibration.md
```

Post and project slugs come from filenames. That means `content/posts/how-this-site-works.md` becomes `/log/how-this-site-works/`, and `content/projects/layout-calibration.md` becomes `/projects/layout-calibration/`.

Frontmatter carries the display metadata:

```yaml
title: How This Site Works
date: 3309-06-21
type: FIELD NOTE
tags:
  - site
  - static
  - markdown
```

The body is plain Markdown, including tables, images, fenced code, lists, and normal article sections.

## The Generator

`build.py` does the heavy lifting:

- loads Markdown and YAML frontmatter
- renders Markdown with syntax highlighting
- generates the homepage from preview data
- generates `/log/` and `/projects/` collection pages
- generates detail pages under `/log/<slug>/` and `/projects/<slug>/`
- generates tag pages and `tag-index.json`
- copies static assets when building `dist/`

The core loop is deliberately direct:

```python
projects = build_projects(tag_index)
latest_intel, posts = build_posts(tag_index)

for project in projects:
    render_content_page(project, "detail.template.html", output_path)

for post in posts:
    render_content_page(post, "detail.template.html", output_path)
```

There is no hidden router. The generated file tree is the router.

## Two Output Modes

There are two build modes because local preview and deploy preview have different ergonomics.

```bash
make build
make dist
make dev
```

`make build` writes generated pages into the repository root, which keeps direct file inspection simple.

`make dist` writes a GitHub Pages-style artifact into `dist/`.

`make dev` builds `dist/`, serves it locally, watches source files, rebuilds on change, and injects a small live-reload script into HTML responses.

## Collections and Previews

The homepage is now a preview surface:

- latest 3 posts
- first 3 projects by manual `order`
- links to the full `/log/` and `/projects/` indexes

The full collection pages are canonical. Detail URLs stay stable:

```text
/log/how-this-site-works/
/projects/layout-calibration/
```

Generated folders are cleaned before rebuilds, so renaming a Markdown file removes the old output path on the next build.

## Styling Pressure

The layout is being tuned around a specific mood: Frontier: Elite II, Privateer-era VGA panels, and space-station terminal UI. The content system now has enough shapes to pressure-test that design:

- card titles, status badges, summaries, bylines, metrics, tags, and actions
- article metadata rows
- Markdown tables with translucent gradient panels
- fenced code blocks with Pygments token spans
- long-form project and post pages

The placeholder project at `/projects/layout-calibration/` exists purely to exercise those shapes before every real project article is finished.

## Checks

The site also has a small static test suite now:

```bash
make check
```

It compiles the Python scripts, builds the site into a temporary directory, checks expected routes, scans generated output for unresolved template placeholders, and verifies that highlighted code blocks actually contain syntax token spans.

That last check exists because a code block can look like it is "highlighted" at the wrapper level while still containing only plain text.

## Why Keep It This Small?

This repository could eventually grow into Eleventy, Astro, Hugo, or another static-site system. For now, the custom generator is still more useful than a framework because the site has unusual presentation requirements and a tiny content model.

The rule is simple: add tooling when it removes real friction. Until then, the build should remain readable enough that opening `build.py` explains the whole machine.
