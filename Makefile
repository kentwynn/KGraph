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
	CURRENT_VERSION="$$(node -p 'require("./package.json").version')"
	NEXT_VERSION="$$(node -e 'const current = process.argv[1]; const release = process.argv[2]; const exact = release.replace(/^v/, ""); if (/^\d+\.\d+\.\d+$$/.test(exact)) { console.log(`v$${exact}`); process.exit(0); } const parts = current.split(".").map(Number); if (parts.length !== 3 || parts.some(Number.isNaN)) { throw new Error(`Invalid package version: $${current}`); } if (release === "patch") parts[2] += 1; else if (release === "minor") { parts[1] += 1; parts[2] = 0; } else if (release === "major") { parts[0] += 1; parts[1] = 0; parts[2] = 0; } else { throw new Error(`Unsupported RELEASE value: $${release}`); } console.log(`v$${parts.join(".")}`);' "$${CURRENT_VERSION}" "$(RELEASE)")"
	BRANCH="release-$${NEXT_VERSION}"
	git switch -c "$${BRANCH}"
	npm version "$${NEXT_VERSION}" --no-git-tag-version
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
	PACKAGE_VERSION="v$$(node -p 'require("./package.json").version')"
	if [ "$${PACKAGE_VERSION}" != "$${VERSION}" ]; then \
		echo "package.json is at $${PACKAGE_VERSION}, but VERSION=$${VERSION}"; \
		exit 1; \
	fi
	git tag "$${VERSION}"
	git push origin "$${VERSION}"
