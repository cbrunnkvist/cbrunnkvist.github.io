.PHONY: help build dist dev check clean

PORT ?= 8000

help:
	@printf '%s\n' \
		'Targets:' \
		'  make build       Build generated pages into the repo root for direct local preview.' \
		'  make dist        Build the GitHub Pages artifact into dist/.' \
		'  make dev         Watch, rebuild dist/, serve, and reload the browser.' \
		'  make check       Compile Python, build content, verify routes/placeholders.' \
		'  make clean       Remove generated output directories.'

build:
	uv run build.py

dist:
	SITE_OUT_DIR=dist uv run build.py

dev: dist
	uv run dev.py --port $(PORT)

check:
	uv run check.py

clean:
	rm -rf dist projects log tags tag-index.json
