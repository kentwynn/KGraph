SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c

.PHONY: help release release-tag

RELEASE ?= patch

help:
	@printf '%s\n' \
		'KGraph make targets:' \
		'  make release              Bump package version on a release branch, push it, and open a PR when gh is available' \
		'  make release RELEASE=minor Same release flow with npm version minor' \
		'  make release-tag VERSION=v0.2.2 Tag the merged release commit on main and push the tag'

release:
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo 'Working tree has uncommitted changes. Commit or stash them before release.'; \
		exit 1; \
	fi
	git fetch origin
	git switch main
	git pull --ff-only origin main
	NEXT_VERSION="$$(npm version "$(RELEASE)" --no-git-tag-version)"
	BRANCH="release-$${NEXT_VERSION}"
	git switch -c "$${BRANCH}"
	git add package.json package-lock.json
	git commit -m "chore: release $${NEXT_VERSION}"
	git push -u origin "$${BRANCH}"
	if command -v gh >/dev/null 2>&1; then \
		gh pr create \
			--base main \
			--head "$${BRANCH}" \
			--title "chore: release $${NEXT_VERSION}" \
			--body "Release $${NEXT_VERSION}."; \
	else \
		echo "Open a pull request:"; \
		echo "https://github.com/kentwynn/KGraph/pull/new/$${BRANCH}"; \
	fi
	echo "After the PR merges, run: make release-tag VERSION=$${NEXT_VERSION}"

release-tag:
	@if [ -z "$${VERSION:-}" ]; then \
		echo 'Usage: make release-tag VERSION=v0.2.2'; \
		exit 1; \
	fi
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo 'Working tree has uncommitted changes. Commit or stash them before tagging.'; \
		exit 1; \
	fi
	git fetch origin
	git switch main
	git pull --ff-only origin main
	PACKAGE_VERSION="v$$(node -p "require('./package.json').version")"
	if [ "$${PACKAGE_VERSION}" != "$${VERSION}" ]; then \
		echo "package.json is at $${PACKAGE_VERSION}, but VERSION=$${VERSION}"; \
		exit 1; \
	fi
	git tag "$${VERSION}"
	git push origin "$${VERSION}"
