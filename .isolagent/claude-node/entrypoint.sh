#!/bin/sh
# isolagent drops your Mac's ~/.claude/CLAUDE.md and settings into
# ~/.host-claude/ (read-only) at start. Copy them where Claude Code reads
# them; the Mac's versions win over edits made in an earlier sandbox.
for f in CLAUDE.md settings.json settings.local.json; do
    if [ -f "$HOME/.host-claude/$f" ]; then
        cp "$HOME/.host-claude/$f" "$CLAUDE_CONFIG_DIR/$f"
    fi
done

exec "$@"
