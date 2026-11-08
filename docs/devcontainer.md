# Dev container

Optional. A container for running Claude Code (or yourself) against one
branch, with a token that can reach this repository and nothing else. The
`.sbx/` Docker Sandbox is the other option; this one is for VS Code's
**Reopen in Container**.

## Quick start

```bash
git worktree add .worktrees/<slug> -b feat/<slug>
cd .worktrees/<slug> && pnpm install   # generates the husky hooks on the host
code .                                 # then: Reopen in Container
```

A worktree is recommended (one container per branch), but the main checkout
opens too: run `pnpm install` on the host once, then **Reopen in Container**.
`pnpm install`, the Playwright browser check and a guardrail self-test run on
creation; a failure stops the build with the reason. The first build takes
several minutes (the Node feature); later ones reuse the image.

Without VS Code: `npx @devcontainers/cli@0.89.0 up --workspace-folder .`.
Older CLI versions hang after `compose up` on Docker 29 (they wait for an
event field Docker removed).

## What is in it

| Piece                      | Source                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Base image                 | `mcr.microsoft.com/playwright:v1.61.1-noble` — bump with `@playwright/test`                             |
| Node 22.23.4, pnpm 10.33.0 | devcontainer `node` feature — same as the sbx kit, bump together                                        |
| Claude Code CLI            | Anthropic feature; latest at build — rebuild to update                                                  |
| `playwright` MCP server    | `@playwright/mcp@0.0.84`, registered in `post-create.sh` for `/visual-verify` — same pin as the sbx kit |
| gh, jq                     | apt, in `post-create.sh`                                                                                |

Claude's config lives in a per-container volume and survives a rebuild.
`node_modules` (per worktree), the pnpm store (per container) and the
Playwright browsers (`nflds-playwright-browsers`, shared) are volumes, off the
macOS bind mount. Forwarded ports: 3273 (dev), 4173 (preview), 9323
(Playwright report).

### Compared with the Docker Sandbox (`.sbx/`)

Same Node, pnpm, Playwright and MCP versions and the same ports. Bump them in
both. The differences:

|                    | Dev container                                                   | Docker Sandbox                                                  |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Network            | unrestricted                                                    | allow list in the kit                                           |
| Workspace          | `.husky`, `.claude`, `.devcontainer` read-only; `.git` writable | repo read-write, incl. `.git` and hooks                         |
| `node_modules`     | Linux-only volume                                               | shared with the host (`pnpm-workspace.yaml` installs both OSes) |
| GitHub auth        | fine-grained PAT for this repo only                             | host SSH agent: wherever your key can push                      |
| Git guardrail hook | yes, plus branch pin and no sudo                                | the hook runs, no branch pin                                    |

## Host environment

Export before opening the container:

| Variable                  | What                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `GH_NFLDS_TOKEN`          | Fine-grained PAT, see below                                 |
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`; skips the login in the container |

Both are optional; without the PAT, `git push` and `gh` fail in the container.

### The PAT

GitHub → Settings → Developer settings → Fine-grained tokens:

- **Repository access:** only `ttu/nfl-draft-success`
- **Permissions:** Contents, Pull requests, Issues — read and write. Nothing
  else: no Administration, Secrets, Actions or Workflows, so the agent cannot
  change settings, secrets or CI.

Inside the container it is `GH_TOKEN`, and `gh` is git's credential helper.
SSH remotes are rewritten to HTTPS in the container's own `~/.gitconfig`, so
git never uses your SSH key there. `post-create.sh` proves the token with a
`push --dry-run`.

### GitHub settings that do the real limiting

The PAT acts as you, so GitHub — not a hook — is what bounds the agent:

- **A ruleset on `main`** with no bypass actors: block force pushes and
  deletions, require a pull request and the CI checks. Without it the agent
  can push to `main`, which deploys.
- **Required reviewer on the deploy environment** if production deploys are
  ever triggered by something the PAT can push (tags, workflow dispatch).

## Guardrail

`.claude/hooks/block-dangerous-git.sh` is a `PreToolUse` hook on Claude's Bash
tool, **active on the host as well**. It refuses:

- Local state git cannot give back: `reset --hard`, `clean -f`,
  `checkout .`, `restore .`, `branch -D`, `stash drop`, `update-ref`,
  `filter-branch`, `reflog expire`, `worktree remove`, `gc`, `prune`.
- Merging PRs (`gh pr merge`, REST/GraphQL merge). The agent opens PRs; you
  merge them.
- On the host only (where git and `gh` use your own login): force-pushes,
  pushes to `main`, tag pushes, branch-deleting pushes, `gh
release/repo/secret/workflow` changes and `gh api` writes (except replying
  to and resolving review threads).

Inside the container (`NFLDS_DEVCONTAINER=1`) it also pins the agent to the
branch the container was created on. The pin is
`/etc/devcontainer-allowed-branch`, root-owned; if it is missing all git and
`gh` commands are refused. `post-create.sh` ends by **removing sudo**, so
nothing in the container can change the pin. To install something later,
rebuild, or `docker exec -u root` from the host.

`pnpm run test:guardrail` runs the hook's cases in a throwaway container.

### Read-only mounts

Mounted **read-only**: `.husky/`, `.claude/` (the hook and its settings —
Claude's Edit/Write tools are not gated by a Bash hook) and `.devcontainer/`
(`initialize.sh` runs on the host). The shared `.git` is mounted read-write
at its host path (see Security risks).

Consequences:

- Changes to `.husky/`, `.claude/` or the container are made from the host.
- `initialize.sh` sets the branch upstream on the host, so a bare
  `git push` works.
- Auto-gc is off and `git gc` / `worktree prune` are blocked: the other
  worktrees aren't mounted and would look prunable. Run them on the host.

## Security risks (accepted)

- **The shared `.git` is writable.** Its config (fsmonitor, pager, filters,
  `core.hooksPath`) and `hooks/` decide what host git runs, so the container
  can make your next host `git` command run its code. A read-only split
  (separate main/worktree compose files) was dropped as not worth the
  complexity. Check the git config and hooks before using git on the host
  after an untrusted session.

- **The hook matches command text.** It stops accidents and obvious detours,
  not a determined agent. Shell spelling is open-ended; nothing on GitHub
  should depend on the hook.
- **Code you run on the host.** The worktree is a shared bind mount:
  `package.json` scripts, configs, tests and `scripts/*.ts` the agent changed
  run on the host the next time you run `pnpm` there (including via the
  husky pre-commit hook, which runs the build and tests). Review the diff
  before running anything from a container's worktree on the host.
- **Any local branch ref can move.** `refs/` must be writable for commits and
  git cannot narrow that to one branch, so the container can move `main` in
  the shared `.git`. The ruleset stops it reaching GitHub; the host reflog
  recovers it.
- **The PAT can do anything its permissions allow** on this repo, as you:
  push branches, open/close PRs and issues, comment. Keep the scope minimal
  and set an expiry.
- **Unrestricted network.** The container can reach any host (unlike the sbx
  allow list), so a prompt-injected agent could exfiltrate the PAT or the
  Claude token. Both are scoped to limit the damage; revoke them if in doubt.
- **On the host the hook uses your full login.** Outside the container the
  agent's git and `gh` reach every repo you can; only the hook stands
  between it and a force-push.
- **VS Code forwards credentials.** VS Code may forward your SSH agent and git
  credential helper into the container. The HTTPS rewrite makes git use the
  PAT for github.com, but the forwarded agent socket is still reachable by
  processes in the container.
