.PHONY: help build dist dev clean

PORT ?= 8000

help:
	@printf '%s\n' \
		'Targets:' \
		'  make build       Build generated pages into the repo root for direct local preview.' \
		'  make dist        Build the GitHub Pages artifact into dist/.' \
		'  make dev         Watch, rebuild dist/, serve, and reload the browser.' \
		'  make clean       Remove generated output directories.'

build:
	uv run build.py

dist:
	SITE_OUT_DIR=dist uv run build.py

dev: dist
	uv run dev.py --port $(PORT)

clean:
	rm -rf dist projects log tags tag-index.json
