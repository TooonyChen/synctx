# <p align="center">Synctx</p>

### <p align="center"><b>Sync your context between agents</b></p>

---

`synctx` is a Bun + Ink terminal UI for browsing recent local AI coding sessions and reopening them in another agent.

It scans each tool's native session store, shows a unified "recent sessions" list, and lets you:

- resume a session in its original agent
- import the conversation into another supported agent
- copy the session ID for manual resume/debugging

## Current Scope

The current implementation is focused on local session interoperability between:

- Claude Code
- Codex
- OpenCode

## Install

### npm (requires [Bun](https://bun.sh) runtime)

```bash
bun install -g @synctx/synctx
synctx
```

### Standalone binary (no dependencies)

Download from [GitHub Releases](https://github.com/TooonyChen/synctx/releases):

```bash
# Apple Silicon
curl -fsSL -o synctx https://github.com/TooonyChen/synctx/releases/latest/download/synctx-macos-arm64
# Intel Mac
curl -fsSL -o synctx https://github.com/TooonyChen/synctx/releases/latest/download/synctx-macos-x64

chmod +x synctx
sudo mv synctx /usr/local/bin/
```

### Build from source

```bash
bun install
bun run build
bun run dist/cli.js
```

### Requirements

- **macOS** (currently the only supported platform)
- one or more supported agent CLIs installed and available on `PATH`
  - `claude`
  - `codex`
  - `opencode`

## How It Works

1. On the first run, `synctx` creates `~/.synctx/synctx.db` and detects installed agent binaries.
2. It reads sessions directly from each agent's native storage format.
3. The dashboard merges those sessions into a single list sorted by last activity.
4. Selecting a session opens an action menu where you can resume it directly or write it into another agent's native format and launch that agent.

Keyboard flow:

- list view: `↑` / `↓` to navigate, `enter` to select, `q` or `esc` to quit
- action view: `↑` / `↓` to navigate, `enter` to run, `q` or `esc` to go back

## Agent Support

| Agent | Read existing sessions | Import/write target | Resume command | Notes |
| --- | --- | --- | --- | --- |
| Claude Code | Yes | Yes | `claude --resume <session-id>` | Imports are written as project-scoped JSONL files under `~/.claude/projects/...` |
| Codex | Yes | Yes | `codex resume <session-id>` | Imports register in both `~/.codex/session_index.jsonl` and `~/.codex/state_5.sqlite` so they are discoverable and render correctly |
| OpenCode | Yes | Yes | `opencode -s <session-id>` | Imports are written into OpenCode's SQLite schema so they can be resumed natively |
| Aider | No | No | N/A | Binary detection only for now |

## Storage Sources

The current readers use these native stores:

- Claude Code: `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`
- Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- OpenCode: `~/.local/share/opencode/opencode.db` (SQLite)

## Limitations

- The help text still mentions a `watch` command, but the current CLI flow is the interactive dashboard only.
- Clipboard copy uses `pbcopy` (macOS only).
