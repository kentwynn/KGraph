SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c

.PHONY: help release release-minor release-major clean-branches clean-branches-dry-run

help:
	@printf '%s\n' \
		'KGraph make targets:' \
		'  make release              Interactive patch release (bumps version, updates CHANGELOG, tags, pushes)' \
		'  make release-minor        Interactive minor release' \
		'  make release-major        Interactive major release' \
		'  make clean-branches-dry-run List merged local/remote branches that can be cleaned' \
		'  make clean-branches       Delete merged local/remote branches, keeping main, release-*, and dependabot/*'

release:
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo 'Working tree has uncommitted changes. Commit or stash them before release.'; \
		exit 1; \
	fi
	git fetch origin
	git switch main
	git pull --ff-only origin main
	npm run build && npm test
	npx release-it patch

release-minor:
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo 'Working tree has uncommitted changes. Commit or stash them before release.'; \
		exit 1; \
	fi
	git fetch origin
	git switch main
	git pull --ff-only origin main
	npm run build && npm test
	npx release-it minor

release-major:
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo 'Working tree has uncommitted changes. Commit or stash them before release.'; \
		exit 1; \
	fi
	git fetch origin
	git switch main
	git pull --ff-only origin main
	npm run build && npm test
	npx release-it major

clean-branches-dry-run:
	git fetch origin --prune
	git switch main
	git pull --ff-only origin main
	echo 'Merged local branches that would be deleted:'
	git branch --merged main | sed 's/^[* ]*//' | grep -Ev '^(main|release-|$$)' || true
	echo ''
	echo 'Merged remote branches that would be deleted:'
	git branch -r --merged origin/main | sed 's#^[ ]*origin/##' | grep -Ev '^(HEAD|main|release-|dependabot/|$$)' || true

clean-branches:
	git fetch origin --prune
	git switch main
	git pull --ff-only origin main
	git branch --merged main | sed 's/^[* ]*//' | grep -Ev '^(main|release-|$$)' > /tmp/kgraph-local-branches || true
	if [ -s /tmp/kgraph-local-branches ]; then \
		xargs git branch -d < /tmp/kgraph-local-branches; \
	else \
		echo 'No merged local branches to delete.'; \
	fi
	rm -f /tmp/kgraph-local-branches
	git branch -r --merged origin/main | sed 's#^[ ]*origin/##' | grep -Ev '^(HEAD|main|release-|dependabot/|$$)' > /tmp/kgraph-remote-branches || true
	if [ -s /tmp/kgraph-remote-branches ]; then \
		xargs -I {} git push origin --delete {} < /tmp/kgraph-remote-branches; \
	else \
		echo 'No merged remote branches to delete.'; \
	fi
	rm -f /tmp/kgraph-remote-branches
