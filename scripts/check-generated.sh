#!/bin/sh
#
# Fails when `pnpm run build` has rewritten a tracked artifact.
#
# The build regenerates these from `src/` and `public/data/`, so a change to
# scoring or to the data moves them. They are committed, which means they can
# go stale — and the way they go stale is quiet. In the pre-commit hook the
# build runs *after* lint-staged has staged everything, so a regenerated
# artifact is simply left dirty in the working tree and the commit succeeds
# without it. That is how `default-rankings.json` came to sit one commit behind
# the change that moved it.
#
# Run after the build, in the hook and in CI both. Compares the working tree
# against the index, so it passes once the artifacts are staged (the hook) or
# once they match what was committed (CI).

# What `pnpm run build` regenerates and the repo commits.
#
# `public/og-image.png` is deliberately absent. The build rasterises it from
# `og-image.svg` through sharp, so its bytes follow the host's libvips and
# fonts — 46111 bytes on macOS against 46868 on Linux for the same input. It
# cannot be held to byte equality across machines, and holding it there would
# only teach everyone to ignore this check.
#
# `public/data/team-success.json` is absent too: `pnpm update-data` writes it,
# `pnpm build` never does, so the build can't have moved it.
ARTIFACTS="public/data/default-rankings.json
public/data/lagged-draft-rankings.json
public/sitemap.xml"

# Word-splitting on the newline-separated list is the point here.
# shellcheck disable=SC2086
if git diff --quiet -- $ARTIFACTS; then
  exit 0
fi

echo ""
echo "✗ The build rewrote tracked artifacts that are not in this commit:"
# shellcheck disable=SC2086
git diff --name-only -- $ARTIFACTS | sed 's/^/    /'
echo ""
echo "  What moved:"
# Bounded: enough to recognise a real change, or to spot the last-digit drift
# that means a number is being written at more precision than it has.
# shellcheck disable=SC2086
git diff --unified=0 --no-color -- $ARTIFACTS | grep -E '^[-+][^-+]' | head -20 | sed 's/^/    /'
echo ""
echo "  They are generated from the code and data you are committing, so they"
echo "  belong in the same commit. Stage them and commit again:"
echo ""
# shellcheck disable=SC2086
git diff --name-only -- $ARTIFACTS | tr '\n' ' ' | sed 's/^/    git add /;s/ $/\n/'
echo ""
exit 1
