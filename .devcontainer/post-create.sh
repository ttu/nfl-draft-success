#!/usr/bin/env bash
# Runs once after the container is created (see devcontainer.json).
set -euo pipefail

WORKSPACE=/workspaces/nfl-draft-success
cd "$WORKSPACE"

echo "==> Claude Code config"
sudo chown -R "$(id -u):$(id -g)" "$HOME/.claude"
if [[ ! -f "$HOME/.claude.json" ]]; then
  echo '{"hasCompletedOnboarding":true,"theme":"dark"}' > "$HOME/.claude.json"
fi

echo "==> jq and gh"
# jq is the git guardrail hook's fast path; gh uses GH_NFLDS_TOKEN for PRs and
# as git's credential helper. Neither ships in the base image.
missing=()
command -v jq >/dev/null 2>&1 || missing+=(jq)
command -v gh >/dev/null 2>&1 || missing+=(gh)
if [[ ${#missing[@]} -gt 0 ]]; then
  sudo apt-get update -qq && sudo apt-get install -y -qq "${missing[@]}"
fi

echo "==> Playwright browsers"
# /ms-playwright is a shared named volume; make it writable. Usually a no-op:
# the image tag matches @playwright/test, so chromium is already present.
sudo chown -R "$(id -u):$(id -g)" "${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}"
pnpm exec playwright install chromium
# Same pinned server as the sbx kit: /visual-verify calls mcp__playwright__*.
# @playwright/mcp bundles its own Playwright, so fetch that Chromium too
# (PLAYWRIGHT_SKIP_BROWSER_GC keeps the two installs from deleting each other).
# Bump together with .sbx/nfl-draft-success/nfl-draft-success.yaml.
npx -y -p @playwright/mcp@0.0.84 playwright install chromium

echo "==> Claude Code MCP: playwright"
claude mcp remove --scope user playwright >/dev/null 2>&1 || true
claude mcp add --scope user playwright -- npx -y @playwright/mcp@0.0.84 --headless --isolated --browser chromium --caps vision --viewport-size 1280x900

echo "==> Git hooks (husky, generated on the host)"
# .husky is mounted read-only and HUSKY=0 stops pnpm regenerating .husky/_, so it
# must already exist from a host install. Without it every commit in the
# container would skip lint-staged, type-check and the tests.
if [[ ! -f "$WORKSPACE/.husky/_/pre-commit" ]]; then
  echo "FAIL: .husky/_ has no hooks. Run 'pnpm install' on the host in this" >&2
  echo "      checkout once, then rebuild the container." >&2
  exit 1
fi
echo "    husky hooks present (read-only)"

echo "==> Verifying git works (worktrees need the mounts from initialize.sh)"
# The read-only mounts nested in the workspace make it appear root-owned, and
# git refuses a repository owned by someone else. Trust exactly these paths,
# in this container's own ~/.gitconfig.
for dir in "$WORKSPACE" "${LOCAL_WORKSPACE_FOLDER:-}"; do
  if [[ -n "$dir" ]] && ! git config --global --get-all safe.directory | grep -qxF "$dir"; then
    git config --global --add safe.directory "$dir"
  fi
done
if ! git -C "$WORKSPACE" rev-parse --git-dir >/dev/null 2>&1; then
  echo "FAIL: git is not usable inside the container." >&2
  echo "      If this workspace is a git worktree, check that .devcontainer/.env" >&2
  echo "      exists and rebuild the container so initialize.sh runs." >&2
  exit 1
fi
# A worktree whose host path is not visible here looks prunable, and a gc would
# delete the shared admin dir — breaking it on the host too.
ADMIN_DIR=$(git -C "$WORKSPACE" rev-parse --absolute-git-dir)
if [[ -f "$ADMIN_DIR/gitdir" ]]; then
  BACK_POINTER=$(cat "$ADMIN_DIR/gitdir")
  if [[ ! -e "$BACK_POINTER" ]]; then
    echo "FAIL: this worktree is not visible at its recorded path:" >&2
    echo "        $BACK_POINTER" >&2
    echo "      The LOCAL_WORKSPACE_FOLDER bind mount is missing. Check" >&2
    echo "      .devcontainer/.env and rebuild the container." >&2
    exit 1
  fi
  echo "    worktree back-pointer OK"
fi
echo "    git OK ($(git -C "$WORKSPACE" rev-parse --git-common-dir))"

echo "==> Git identity (seeded from host, container-local only)"
if [[ -z "$(git config --global user.name 2>/dev/null || true)" && -n "${HOST_GIT_USER_NAME:-}" ]]; then
  git config --global user.name "$HOST_GIT_USER_NAME"
fi
if [[ -z "$(git config --global user.email 2>/dev/null || true)" && -n "${HOST_GIT_USER_EMAIL:-}" ]]; then
  git config --global user.email "$HOST_GIT_USER_EMAIL"
fi
if git config --global user.name >/dev/null 2>&1; then
  echo "    $(git config --global user.name) <$(git config --global user.email)>"
else
  echo "    no identity on host or in container; set user.name/user.email before committing"
fi

echo "==> Git authentication (HTTPS via GH_NFLDS_TOKEN, container-local only)"
# All github.com traffic goes over HTTPS with a token scoped to this repo, not
# over the SSH agent VS Code would forward. --global is this container's own
# ~/.gitconfig, so the host's config and remote are untouched.
# --add appends, and post-create.sh runs again after a failed `up`: add each
# rewrite only once.
for from in "git@github.com:" "ssh://git@github.com/"; do
  if ! git config --global --get-all url."https://github.com/".insteadOf | grep -qxF "$from"; then
    git config --global --add url."https://github.com/".insteadOf "$from"
  fi
done
# devcontainer.json maps the host's GH_NFLDS_TOKEN to GH_TOKEN.
if [[ -n "${GH_TOKEN:-}" ]]; then
  gh auth setup-git
  # A dry-run push makes GitHub authenticate the token while writing nothing;
  # ls-remote would pass anonymously on a public repo.
  if git -C "$WORKSPACE" push --dry-run origin \
      "HEAD:refs/heads/__devcontainer_auth_check__" >/dev/null 2>&1; then
    echo "    git authenticates via GH_NFLDS_TOKEN — verified"
  else
    echo "FAIL: GH_NFLDS_TOKEN is set but git could not authenticate to 'origin'." >&2
    echo "      The token needs Contents: Read and write on ttu/nfl-draft-success." >&2
    exit 1
  fi
else
  echo "    GH_NFLDS_TOKEN not set on the host: git push and gh will fail until it is"
fi

echo "==> Pinning container to its own branch"
# The guardrail hook reads this file and refuses to touch any other branch.
CONTAINER_BRANCH=$(git -C "$WORKSPACE" rev-parse --abbrev-ref HEAD)
if [[ -z "$CONTAINER_BRANCH" || "$CONTAINER_BRANCH" == "HEAD" ]]; then
  echo "FAIL: could not determine the current branch to pin to" >&2
  exit 1
fi
# Root-owned and read-only: the agent runs as `ubuntu` and must not be able
# to edit or delete it. The hook refuses all git if it goes missing.
printf '%s\n' "$CONTAINER_BRANCH" | sudo tee /etc/devcontainer-allowed-branch >/dev/null
sudo chown root:root /etc/devcontainer-allowed-branch
sudo chmod 444 /etc/devcontainer-allowed-branch
echo "    confined to branch '$CONTAINER_BRANCH'"

echo "==> Verifying git guardrail hook is active"
GUARD="$WORKSPACE/.claude/hooks/block-dangerous-git.sh"
if [[ ! -x "$GUARD" ]]; then
  echo "FAIL: $GUARD missing or not executable" >&2
  exit 1
fi
set +e
# Must block destroying local work...
printf '%s' '{"tool_input":{"command":"git reset --hard"}}' | bash "$GUARD" >/dev/null 2>&1
blocked=$?
# ...must block leaving the pinned branch...
printf '%s' '{"tool_input":{"command":"git switch -c guardrail-self-test"}}' | bash "$GUARD" >/dev/null 2>&1
off_branch=$?
# ...and must still allow ordinary work.
printf '%s' '{"tool_input":{"command":"git status"}}' | bash "$GUARD" >/dev/null 2>&1
allowed=$?
set -e
if [[ "$blocked" -ne 2 || "$off_branch" -ne 2 || "$allowed" -ne 0 ]]; then
  echo "FAIL: git guardrail self-test failed (reset --hard=$blocked want 2," >&2
  echo "      new branch=$off_branch want 2, status=$allowed want 0)" >&2
  exit 1
fi
echo "    git guardrail OK"

echo "==> Dropping sudo"
# Everything above needed root; nothing after does. Without this the agent
# could rewrite the root-owned branch pin, or remount anything. The account's
# password is locked, so the image's `%sudo` rule grants nothing once the
# passwordless rule is gone. To install something later, rebuild, or use
# `docker exec -u root` from the host.
sudo rm -f /etc/sudoers.d/ubuntu
if sudo -n true 2>/dev/null; then
  echo "FAIL: sudo still works after removing /etc/sudoers.d/ubuntu" >&2
  exit 1
fi
echo "    sudo disabled for $(id -un)"

echo "==> Versions"
echo "    node $(node -v) / pnpm $(pnpm -v)"

echo "==> Dev container ready"
