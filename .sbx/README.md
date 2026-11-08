# Docker Sandbox

Runs Claude Code for this repo in a [Docker Sandbox](https://docs.docker.com/ai/sandboxes/) (`sbx`, signed in with `sbx login`).

```sh
sbx env run                     # create on first run, then attach Claude
sbx env exec -- pnpm test:e2e   # run a command in the sandbox
sbx ports nfl-draft-success     # host ports mapped to 3273 / 4173
sbx env rm                      # remove the sandbox
```

What the sandbox includes:

- `sbxenv.yaml` (repo root): the Claude agent, the repo mounted read-write, and ports 3273 (dev) and 4173 (preview).
- `nfl-draft-success/nfl-draft-success.yaml`: a project mixin that installs Node 22, pnpm and Chromium for Playwright 1.61.1 (the lockfile version; the hardened `sbx/claude` base has no Node), sets the outbound allow list, runs `pnpm install` on every boot and registers the `playwright` MCP server that `/visual-verify` uses. When bumping `@playwright/test`, bump `playwright@1.61.1` in the kit too. The browsers live in `/opt/ms-playwright`; the kit exports `PLAYWRIGHT_BROWSERS_PATH` from both `/etc/profile.d` (login shells) and `/etc/sandbox-persistent.sh` (the non-login shells the agent and its git hooks run in), so the pre-commit hook's E2E run finds them. The MCP server is pinned (`@playwright/mcp@0.0.84`) because the kit pre-installs that version's Chromium; bump it in both places in the kit.

The repo is mounted read-write at its host path, so edits in the sandbox (including `node_modules`) change the host checkout directly. This is a known, accepted security risk: the agent can change code the host later runs (git hooks, `package.json` scripts, `node_modules`). Review those before running them on the host, or use clone mode (see `sbxenv.yaml`).

The agent can commit and push. Commits use your host git name and email, and `git push` to the SSH `origin` goes through your host's ssh-agent (needs a key loaded: `ssh-add -l`). The private key stays on the host and the sandbox may only log in to GitHub as `git`, but it can push anywhere that key can.

To open the dev server from the host browser:

1. In the sandbox, start it on all interfaces: `pnpm dev --host`. Plain `pnpm dev` listens only on the sandbox's localhost and is unreachable from the host.
2. On the host, either open the random port that `sbx ports nfl-draft-success` shows for 3273, or publish a fixed one:

   ```sh
   sbx ports nfl-draft-success --publish 3273:3273   # then open http://localhost:3273/
   ```

   This fails if `pnpm dev` is already running on the host on 3273. For preview, use `pnpm preview --host` and `--publish 4173:4173`.

If the site adds a new external image or data host, add it to the `network-policy` allow list in `nfl-draft-success/nfl-draft-success.yaml` and recreate the sandbox (`sbx env rm && sbx env run`).
