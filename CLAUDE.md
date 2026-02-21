# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run build     # compile TypeScript → dist/
bun run dev       # watch mode (tsc --watch)
bun run test      # prettier check + xo lint + ava tests
synctx            # run the CLI (linked globally via npm link)
```

Use **bun** as the package manager, not npm.

## Architecture

synctx is an Ink (React + CLI) app that **syncs conversation sessions across all installed AI coding agents** (Claude Code, Codex, Gemini CLI, OpenCode). It reads session files directly from disk and writes/injects them into other agents — zero token cost — so you can resume a conversation started in one agent seamlessly in another.

### Data flow

1. **First run**: `isFirstRun()` checks for `~/.synctx/synctx.db`. If absent, `InitScreen` runs agent detection (`detectAgents()` calls each binary with `--version`), saves results to SQLite, then transitions to `Dashboard`.
2. **Subsequent runs**: `App` loads stored agents from DB via `getStoredAgents()`, goes straight to `Dashboard`.
3. **Session reading**: `Dashboard` calls `readAllSessions()` on mount, which fans out to all registered `SessionReader` implementations and sorts results by `lastActive`.

### Adding a new agent reader

Implement the `SessionReader` interface in `source/lib/readers/<agentName>.ts`:

```ts
export interface SessionReader {
  agentName: string;
  readSessions(): Session[];
}
```

Then register it in `source/lib/readers/index.ts` → `ALL_READERS` array. The `Session` type (defined in `readers/types.ts`) is the shared contract between all readers and the UI.

### Storage

- SQLite at `~/.synctx/synctx.db` via `bun:sqlite` (not `node:sqlite`)
- Schema: `agents` (detected installations) and `sessions` tables
- `db.ts` runs migrations on every startup — add new `CREATE TABLE IF NOT EXISTS` statements there

### Session title extraction (Claude Code)

Claude Code sessions are JSONL at `~/.claude/projects/<encoded-path>/<session-id>.jsonl`. The first line is always a `file-history-snapshot` (skip it). The session title is derived from the first `type: "user"` entry's message content, with image filenames stripped and truncated to 60 chars. The project directory name encodes the absolute path with `/` replaced by `-`.
