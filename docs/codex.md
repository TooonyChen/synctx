# Codex Session Format & Integration Notes

Codex (OpenAI Codex CLI) stores sessions in JSONL files and tracks them via two registries. This document covers the gotchas discovered while building synctx's Codex reader/writer.

## Session Storage

### File Location

```
~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-no-colons>-<UUID>.jsonl
```

- Date directories are `YYYY/MM/DD` based on session creation time.
- Filename: `rollout-2026-03-10T18-34-09-<uuid>.jsonl`
- ISO timestamp in filename has `:` replaced with `-`.

### Session Registries

Codex does **not** discover sessions by scanning the filesystem. It uses two registries:

1. **`~/.codex/session_index.jsonl`** — lightweight index, one JSON object per line:
   ```json
   {"id":"<uuid>","thread_name":"<title>","updated_at":"<ISO-8601>"}
   ```

2. **`~/.codex/state_5.sqlite`** — `threads` table with full metadata:
   | Column | Type | Notes |
   |--------|------|-------|
   | `id` | TEXT PK | Session UUID |
   | `rollout_path` | TEXT | Absolute path to the JSONL file |
   | `created_at` | INTEGER | **Unix seconds** (not milliseconds) |
   | `updated_at` | INTEGER | **Unix seconds** (not milliseconds) |
   | `source` | TEXT | Must be `cli` or `vscode` — `api` is filtered out by `codex resume` |
   | `model_provider` | TEXT | `openai` |
   | `cwd` | TEXT | Project working directory |
   | `title` | TEXT | Session title (first user message, truncated) |
   | `sandbox_policy` | TEXT | JSON string, e.g. `{"type":"read-only"}` |
   | `approval_mode` | TEXT | `on-request` |
   | `cli_version` | TEXT | Version string |
   | `first_user_message` | TEXT | Full first user message |
   | `memory_mode` | TEXT | `enabled` |

**If you only write the JSONL file without registering in both places, the session will be invisible to Codex.**

### Critical: `source` Field

`codex resume` (interactive mode) filters sessions by the `source` field. Only `cli` and `vscode` sessions appear in the list. Sessions with `source: 'api'` are silently excluded.

### Critical: Timestamp Format

The `created_at` and `updated_at` columns use **Unix seconds** (10 digits), not milliseconds (13 digits). Using `Date.getTime()` directly will produce timestamps 1000x too large, causing the session to appear in the far future and be filtered out.

```ts
// Wrong
const timestamp = now.getTime(); // 1773540438000 (ms)

// Correct
const timestamp = Math.floor(now.getTime() / 1000); // 1773540438 (sec)
```

### CWD Filtering

`codex resume` filters the session list by the current working directory. A session created with `cwd: '/foo/bar'` will only appear when running `codex resume` from `/foo/bar`.

## JSONL Format

### Two Layers: Model Context vs TUI Display

Codex session JSONL has two parallel data layers:

| Layer | Entry Type | Purpose |
|-------|-----------|---------|
| Model context | `response_item` | Sent to the LLM as conversation history |
| TUI display | `event_msg` | Rendered in the terminal UI and Codex App |

**Writing only `response_item` entries means the model can read the context, but the TUI/App shows an empty conversation.** Both layers must be written.

### Entry Types

#### `session_meta` (line 1, required)

```json
{
  "timestamp": "<ISO>",
  "type": "session_meta",
  "payload": {
    "id": "<uuid>",
    "timestamp": "<ISO>",
    "cwd": "<project-path>",
    "originator": "synctx",
    "cli_version": "0.1.0",
    "source": "cli",
    "model_provider": "openai",
    "git": null
  }
}
```

#### `response_item` (model context)

User message:
```json
{
  "timestamp": "<ISO>",
  "type": "response_item",
  "payload": {
    "type": "message",
    "role": "user",
    "content": [{"type": "input_text", "text": "..."}]
  }
}
```

Assistant message:
```json
{
  "timestamp": "<ISO>",
  "type": "response_item",
  "payload": {
    "type": "message",
    "role": "assistant",
    "content": [{"type": "output_text", "text": "..."}]
  }
}
```

#### `event_msg` (TUI display)

Each conversation turn must be wrapped in `task_started` / `task_complete` events:

```json
{"timestamp":"<ISO>","type":"event_msg","payload":{"type":"task_started","turn_id":"<uuid>"}}
{"timestamp":"<ISO>","type":"event_msg","payload":{"type":"user_message","message":"..."}}
{"timestamp":"<ISO>","type":"event_msg","payload":{"type":"agent_message","message":"..."}}
{"timestamp":"<ISO>","type":"event_msg","payload":{"type":"task_complete","turn_id":"<uuid>","last_agent_message":"..."}}
```

### Complete Turn Structure

A single user-assistant turn produces this sequence of JSONL lines:

```
event_msg   task_started       # TUI: begin turn
response_item  user            # Model: user message context
event_msg   user_message       # TUI: render user bubble
response_item  assistant       # Model: assistant message context
event_msg   agent_message      # TUI: render assistant bubble
event_msg   task_complete      # TUI: end turn
```

## Reading Sessions

### Directory Walk

Sessions are found by walking `~/.codex/sessions/YYYY/MM/DD/*.jsonl`.

### System Messages to Skip

Codex injects system-level user messages that should be excluded when extracting session title or message count:

```
<permissions instructions>
<environment_context>
# AGENTS.md instructions for
<INSTRUCTIONS>
```

### `codex resume`

- Accepts a UUID argument: `codex resume <uuid>`
- Interactive mode (no args) filters by CWD and `source` field
- Codex's own display hint uses the first user message as the argument, but UUID works

## Checklist for Writing a Codex Session

1. Generate a UUID for the session ID
2. Create JSONL file at `~/.codex/sessions/YYYY/MM/DD/rollout-<iso>-<uuid>.jsonl`
3. Write `session_meta` as the first line
4. For each turn, write both `response_item` (model) and `event_msg` (TUI) entries
5. Append to `~/.codex/session_index.jsonl`
6. Insert into `state_5.sqlite` `threads` table with `source='cli'` and timestamps in **seconds**
