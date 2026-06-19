# /// script
# dependencies = [
#   "markdown",
#   "PyYAML",
# ]
# ///

from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any

import markdown
import yaml


ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"
OUT_DIR = Path(os.environ.get("SITE_OUT_DIR", ROOT)).resolve()

MARKDOWN_EXTENSIONS = ["extra", "codehilite", "toc"]
STATIC_ASSET_NAMES = ["styles.css", "script.js", "commander-mugshot.png"]
OPTIONAL_STATIC_ASSET_NAMES = ["CNAME", "favicon.ico", "robots.txt"]


@dataclass(frozen=True)
class Entry:
    category: str
    slug: str
    source: Path
    meta: dict[str, Any]
    body_md: str
    body_html: str
    url: str

    @property
    def title(self) -> str:
        return str(self.meta.get("title") or self.slug)

    @property
    def tags(self) -> list[str]:
        tags = self.meta.get("tags") or []
        return [str(tag) for tag in tags]

    @property
    def draft(self) -> bool:
        return bool(self.meta.get("draft", False))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def load_template(name: str) -> str:
    return read_text(TEMPLATES / name)


def render_template(template: str, values: dict[str, str]) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace(f"{{{{ {key} }}}}", value)
    return rendered


def load_markdown(path: Path, category: str, url: str) -> Entry:
    raw = read_text(path)
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.DOTALL)
    if not match:
        raise ValueError(f"{path} is missing YAML frontmatter")

    meta = yaml.safe_load(match.group(1)) or {}
    if not isinstance(meta, dict):
        raise ValueError(f"{path} frontmatter must be a mapping")

    body_md = match.group(2).strip()
    body_html = markdown.markdown(body_md, extensions=MARKDOWN_EXTENSIONS)
    return Entry(
        category=category,
        slug=path.stem,
        source=path,
        meta=meta,
        body_md=body_md,
        body_html=body_html,
        url=url,
    )


def load_entries(category: str, output_prefix: str) -> list[Entry]:
    entries = []
    for path in sorted((CONTENT / category).glob("*.md")):
        entry = load_markdown(path, category, f"{output_prefix}/{path.stem}/")
        if not entry.draft:
            entries.append(entry)
    return entries


def require(entry: Entry, *fields: str) -> None:
    missing = [field for field in fields if field not in entry.meta]
    if missing:
        names = ", ".join(missing)
        raise ValueError(f"{entry.source} is missing required field(s): {names}")


def plain_text(html: str) -> str:
    text = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\s+", " ", text).strip()


def first_paragraph(entry: Entry) -> str:
    explicit = entry.meta.get("description") or entry.meta.get("excerpt")
    if explicit:
        return str(explicit)
    paragraphs = [part.strip() for part in entry.body_md.split("\n\n") if part.strip()]
    return plain_text(markdown.markdown(paragraphs[0])) if paragraphs else ""


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    clipped = text[: limit - 1].rsplit(" ", 1)[0]
    return f"{clipped}..."


def lifecycle_values(meta: dict[str, Any]) -> list[tuple[str, str]]:
    items = []
    for field, label in [("created_at", "CREATED"), ("modified_at", "MODIFIED")]:
        value = meta.get(field)
        if value:
            items.append((label, str(value)))
    return items


def lifecycle_items(entry: Entry) -> list[tuple[str, str]]:
    return lifecycle_values(entry.meta)


def lifecycle_markup(items: list[tuple[str, str]], class_name: str) -> str:
    if not items:
        return ""

    parts = []
    for label, value in items:
        safe_value = escape(value)
        parts.append(
            f"""<span class="{class_name}-item">
                    <span class="{class_name}-label">{label}</span>
                    <time datetime="{safe_value}">{safe_value}</time>
                </span>"""
        )

    return f'<div class="{class_name}">{"".join(parts)}</div>'


def lifecycle_html(entry: Entry, class_name: str) -> str:
    return lifecycle_markup(lifecycle_items(entry), class_name)


def lifecycle_footer_html(entry: Entry) -> str:
    footer = lifecycle_html(entry, "detail-footer")
    return f"<footer>{footer}</footer>" if footer else ""


def tags_html(tags: list[str], root_prefix: str = "") -> str:
    parts = []
    for tag in tags:
        tag_slug = slugify(tag)
        href = f"{root_prefix}tags/{tag_slug}/"
        parts.append(f'<a class="tag-chip" href="{href}">#{escape(tag)}</a>')
    return "\n".join(parts)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "untagged"


def status_class(status: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", status.lower()).strip("-")
    return normalized or "online"


def href_for(entry: Entry, root_prefix: str = "") -> str:
    return f"{root_prefix}{entry.url}"


def build_about(tag_index: dict[str, list[dict[str, Any]]]) -> tuple[str, str, str]:
    entry = load_markdown(CONTENT / "about" / "operator-profile.md", "about", "#about")
    required = ["name", "role", "status", "experience", "base", "nation", "skills"]
    missing = [field for field in required if field not in entry.meta]
    if missing:
        raise ValueError(f"{entry.source} is missing required field(s): {', '.join(missing)}")

    labels = [
        ("name", "NAME"),
        ("role", "ROLE"),
        ("status", "STATUS"),
        ("experience", "EXP"),
        ("base", "BASE"),
        ("nation", "NATION"),
    ]
    info_parts = []
    for field, label in labels:
        value = escape(str(entry.meta[field]))
        if field == "status":
            value_html = f'<span class="fe2-info-value status-active">● {value}</span>'
        else:
            value_html = f'<span class="fe2-info-value">{value}</span>'
        info_parts.append(
            f"""<div class="fe2-info-row">
                            <span class="fe2-info-label">{label}:</span>
                            {value_html}
                        </div>"""
        )

    detail_parts = []
    for paragraph in [part.strip() for part in entry.body_md.split("\n\n") if part.strip()]:
        paragraph_html = markdown.markdown(paragraph)
        paragraph_html = paragraph_html.removeprefix("<p>").removesuffix("</p>")
        paragraph_html = re.sub(
            r"<strong>(.*?)</strong>",
            r'<span class="highlight-text">\1</span>',
            paragraph_html,
        )
        detail_parts.append(
            f"""<p class="fe2-paragraph">
                            <span class="prompt">&gt;</span> {paragraph_html}
                        </p>"""
        )

    skill_parts = []
    for skill in entry.meta.get("skills", []):
        skill_parts.append(
            f"""<div class="fe2-skill-row">
                                <span class="fe2-skill-check">☑</span>
                                <span class="fe2-skill-name">{escape(str(skill.get("name", "")))}</span>
                                <span class="fe2-skill-val">{escape(str(skill.get("value", "")))}</span>
                            </div>"""
        )

    index_tags(tag_index, entry, "Operator Profile")
    return "\n".join(info_parts), "\n".join(detail_parts), "\n".join(skill_parts)


def project_cards_html(projects: list[Entry], root_prefix: str = "") -> str:
    card_parts = []
    for project in projects:
        system_name = str(project.meta["system_name"])
        status = str(project.meta["status"])
        stats = project.meta.get("stats") or []
        stats_html = "\n".join(
            f'<span class="sys-stat">{escape(str(stat))}</span>' for stat in stats
        )
        href = href_for(project, root_prefix)
        card_parts.append(
            f"""<article class="system-card">
                <div class="system-header">
                    <span class="system-icon">{escape(str(project.meta["icon"]))}</span>
                    <h3 class="system-name"><a href="{href}">{escape(system_name)}</a></h3>
                    <span class="system-status {status_class(status)}">{escape(status)}</span>
                </div>
                <p class="system-desc">{escape(first_paragraph(project))}</p>
                {lifecycle_html(project, "card-byline")}
                <div class="system-stats">
                    {stats_html}
                </div>
                <div class="content-tags">
                    {tags_html(project.tags, root_prefix)}
                </div>
                <a class="intel-link" href="{href}">OPEN PROJECT FILE</a>
            </article>"""
        )

    return "\n".join(card_parts)


def post_cards_html(posts: list[Entry], root_prefix: str = "") -> str:
    log_parts = []
    for post in posts:
        href = href_for(post, root_prefix)
        log_parts.append(
            f"""<article class="log-entry">
                <div class="log-header">
                    <span class="log-date">{escape(str(post.meta["date"]))}</span>
                    <span class="log-type">[{escape(str(post.meta["type"]))}]</span>
                </div>
                <h3 class="log-title"><a href="{href}">{escape(post.title)}</a></h3>
                {lifecycle_html(post, "card-byline")}
                <p class="log-content">{escape(first_paragraph(post))}</p>
                <div class="content-tags">
                    {tags_html(post.tags, root_prefix)}
                </div>
                <a class="intel-link" href="{href}">READ LOG ENTRY</a>
            </article>"""
        )

    return "\n".join(log_parts)


def build_projects(tag_index: dict[str, list[dict[str, Any]]]) -> list[Entry]:
    projects = load_entries("projects", "projects")
    for project in projects:
        require(project, "title", "system_name", "icon", "status", "tags")

    projects.sort(key=lambda item: int(item.meta.get("order", 999)))
    for project in projects:
        system_name = str(project.meta["system_name"])
        index_tags(tag_index, project, f"{system_name}: {project.title}")

    return projects


def build_posts(tag_index: dict[str, list[dict[str, Any]]]) -> tuple[str, list[Entry]]:
    posts = load_entries("posts", "log")
    for post in posts:
        require(post, "title", "date", "type", "tags")

    posts.sort(key=lambda item: str(item.meta["date"]), reverse=True)
    for post in posts:
        index_tags(tag_index, post, post.title)

    sidebar_parts = []
    for post in posts[:3]:
        sidebar_parts.append(
            f"""<div class="news-item">
                        <span class="news-date">{escape(str(post.meta["date"]))}</span>
                        <p class="news-text"><a href="{post.url}">{escape(truncate(first_paragraph(post), 118))}</a></p>
                    </div>"""
        )

    return "\n".join(sidebar_parts), posts


def index_tags(tag_index: dict[str, list[dict[str, Any]]], entry: Entry, title: str) -> None:
    for tag in entry.tags:
        tag_index.setdefault(tag, []).append(
            {
                "title": title,
                "category": entry.category,
                "url": entry.url,
                "date": str(entry.meta["date"]) if entry.meta.get("date") else None,
                "created_at": str(entry.meta["created_at"]) if entry.meta.get("created_at") else None,
                "modified_at": str(entry.meta["modified_at"]) if entry.meta.get("modified_at") else None,
                "description": first_paragraph(entry),
            }
        )


def render_content_page(entry: Entry, template_name: str, output_path: Path) -> None:
    meta_rows = []
    for label, field in [
        ("IDENTIFIER", "title"),
        ("DATE", "date"),
        ("CLASS", "type"),
        ("STATUS", "status"),
        ("SOURCE", "source_url"),
        ("REPOSITORY", "repo_url"),
    ]:
        value = entry.meta.get(field)
        if not value:
            continue
        text = escape(str(value))
        if field in {"source_url", "repo_url"}:
            text = f'<a href="{text}" target="_blank" rel="noopener">{text}</a>'
        meta_rows.append(
            f"""<div class="detail-meta-item">
                    <span class="detail-meta-label">{label}:</span>
                    <span class="detail-meta-value">{text}</span>
                </div>"""
        )

    html = render_template(
        load_template(template_name),
        {
            "title": escape(entry.title),
            "heading": escape(str(entry.meta.get("system_name") or entry.title)),
            "subtitle": escape(str(entry.meta.get("description") or entry.meta.get("excerpt") or "")),
            "meta": "\n".join(meta_rows),
            "byline": lifecycle_html(entry, "detail-byline"),
            "body": entry.body_html,
            "tags": tags_html(entry.tags, "../../"),
            "footer": lifecycle_footer_html(entry),
        },
    )
    write_text(output_path, html)


def render_collection_page(
    *,
    title: str,
    heading: str,
    intro: str,
    entries: str,
    output_path: Path,
    root_prefix: str = "../",
) -> None:
    html = render_template(
        load_template("collection.template.html"),
        {
            "title": escape(title),
            "heading": escape(heading),
            "intro": escape(intro),
            "entries": entries,
            "root_prefix": root_prefix,
        },
    )
    write_text(output_path, html)


def render_tag_pages(tag_index: dict[str, list[dict[str, Any]]]) -> None:
    template = load_template("tag.template.html")
    for tag, entries in sorted(tag_index.items(), key=lambda item: item[0].lower()):
        items = sorted(
            entries,
            key=lambda item: (str(item.get("date") or ""), item["title"]),
            reverse=True,
        )
        item_html = []
        for item in items:
            date = f'<span class="log-date">{escape(str(item["date"]))}</span>' if item.get("date") else ""
            byline = lifecycle_markup(lifecycle_values(item), "card-byline")
            item_html.append(
                f"""<article class="tag-index-entry">
                    <div class="log-header">
                        {date}
                        <span class="log-type">[{escape(str(item["category"]).upper())}]</span>
                    </div>
                    <h2 class="log-title"><a href="../../{escape(str(item["url"]))}">{escape(str(item["title"]))}</a></h2>
                    {byline}
                    <p class="log-content">{escape(str(item["description"]))}</p>
                </article>"""
            )

        html = render_template(
            template,
            {
                "title": f"#{escape(tag)}",
                "heading": f"TAG INDEX: #{escape(tag)}",
                "entries": "\n".join(item_html),
            },
        )
        write_text(OUT_DIR / "tags" / slugify(tag) / "index.html", html)


def clean_generated_dirs() -> None:
    if OUT_DIR != ROOT and OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
        return

    for directory in [OUT_DIR / "projects", OUT_DIR / "log", OUT_DIR / "tags"]:
        if directory.exists():
            shutil.rmtree(directory)


def copy_static_assets() -> None:
    if OUT_DIR == ROOT:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name in STATIC_ASSET_NAMES:
        src = ROOT / name
        if not src.exists():
            raise FileNotFoundError(f"Required static asset is missing: {src}")
        shutil.copy2(src, OUT_DIR / name)

    for name in OPTIONAL_STATIC_ASSET_NAMES:
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, OUT_DIR / name)

    write_text(OUT_DIR / ".nojekyll", "")


def build() -> None:
    tag_index: dict[str, list[dict[str, Any]]] = {}

    about_info, about_details, about_skills = build_about(tag_index)
    projects = build_projects(tag_index)
    latest_intel, posts = build_posts(tag_index)

    clean_generated_dirs()

    for project in projects:
        render_content_page(project, "detail.template.html", OUT_DIR / "projects" / project.slug / "index.html")
    for post in posts:
        render_content_page(post, "detail.template.html", OUT_DIR / "log" / post.slug / "index.html")
    render_collection_page(
        title="Mission Log",
        heading="MISSION LOG",
        intro="Full archive of operational notes, release logs, protocol work, and field reports.",
        entries=post_cards_html(posts, "../"),
        output_path=OUT_DIR / "log" / "index.html",
    )
    render_collection_page(
        title="Project Files",
        heading="PROJECT FILES",
        intro="Complete system manifest, ordered by current operational priority.",
        entries=f'<div class="systems-grid">{project_cards_html(projects, "../")}</div>',
        output_path=OUT_DIR / "projects" / "index.html",
    )
    render_tag_pages(tag_index)
    copy_static_assets()

    index_html = render_template(
        load_template("index.template.html"),
        {
            "about_info": about_info,
            "about_details": about_details,
            "about_skills": about_skills,
            "systems_grid": project_cards_html(projects[:3]),
            "logs": post_cards_html(posts[:3]),
            "latest_intel": latest_intel,
        },
    )
    write_text(OUT_DIR / "index.html", index_html)

    serializable_index = {
        tag: sorted(items, key=lambda item: (str(item.get("date") or ""), item["title"]), reverse=True)
        for tag, items in sorted(tag_index.items(), key=lambda item: item[0].lower())
    }
    write_text(OUT_DIR / "tag-index.json", json.dumps(serializable_index, indent=2) + "\n")
    print(f"Generated {len(projects)} project pages, {len(posts)} log pages, and {len(tag_index)} tag pages.")


if __name__ == "__main__":
    build()
