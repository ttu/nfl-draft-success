# claude-node flavor: claude-sandbox plus Node, pnpm and Playwright's Chromium,
# for this project. Named by flavor in ../../.isolagent.toml; isolagent run builds it when it changes.

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        xz-utils \
        zsh \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# Node from nodejs.org (Debian's is too old for Vite 7); pnpm pinned to package.json's packageManager.
ARG NODE_VERSION=24.9.0
ARG PNPM_VERSION=10.33.0
RUN arch="$(dpkg --print-architecture | sed 's/amd64/x64/')" \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz" \
       | tar -xJ -C /usr/local --strip-components=1 \
    && npm install -g "pnpm@${PNPM_VERSION}" \
    && node --version && pnpm --version

# Chromium's system libraries need root; the browser itself goes in the user's cache below.
# shortcut: pinned to the lockfile's Playwright, bump and rebuild when @playwright/test changes.
ARG PLAYWRIGHT_VERSION=1.61.1
RUN npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm

# isolagent runs the agent as this user; it must exist and not be root.
RUN useradd -m -s /bin/zsh claude

USER claude
WORKDIR /home/claude

RUN npx -y "playwright@${PLAYWRIGHT_VERSION}" install chromium && rm -rf /home/claude/.npm \
    && mkdir -p /home/claude/.local/bin \
    && ln -s "$(ls -d /home/claude/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -n1)" /home/claude/.local/bin/chromium \
    && /home/claude/.local/bin/chromium --version

# Playwright MCP (/visual-verify) defaults to Google Chrome, which has no Linux arm64 build:
# point it at the Chromium above, headless, since the sandbox has no display.
ENV PLAYWRIGHT_MCP_EXECUTABLE_PATH=/home/claude/.local/bin/chromium
ENV PLAYWRIGHT_MCP_HEADLESS=true

RUN curl -fsSL https://claude.ai/install.sh | bash && "$HOME/.local/bin/claude" --version

RUN git config --global 'credential.https://github.com.helper' \
        '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' \
    && git config --global 'url.https://github.com/.insteadOf' 'git@github.com:' \
    && git config --global init.defaultBranch main

RUN mkdir -p /home/claude/.claude-data
ENV CLAUDE_CONFIG_DIR=/home/claude/.claude-data
ENV PATH="/home/claude/.local/bin:${PATH}"
# The image is a fresh clone each start; keep pnpm's store in the persistent state folder.
ENV npm_config_store_dir=/home/claude/.claude-data/pnpm-store

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

WORKDIR /work

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["zsh"]
