# OpenCode Session Format & Integration Notes

OpenCode stores sessions in a SQLite database rather than transcript files. This document captures the practical details and gotchas discovered while building synctx's OpenCode reader/writer.

## Session Storage

### Database Location

```text
~/.local/share/opencode/opencode.db
```

Platform-specific paths in synctx:

- macOS: `~/.local/share/opencode/opencode.db`
- Linux: `~/.local/share/opencode/opencode.db`
- Windows: `~/AppData/Local/opencode/opencode.db`

### Core Tables

synctx currently interacts with four tables:

1. `project`
2. `session`
3. `message`
4. `part`

Minimal observed schema:

```sql
CREATE TABLE project (
  id text PRIMARY KEY,
  worktree text NOT NULL,
  name text,
  sandboxes text NOT NULL,
  time_created integer NOT NULL,
  time_updated integer NOT NULL
);

CREATE TABLE session (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  slug text NOT NULL,
  directory text NOT NULL,
  title text NOT NULL,
  version text NOT NULL,
  time_created integer NOT NULL,
  time_updated integer NOT NULL,
  time_archived integer
);

CREATE TABLE message (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  time_created integer NOT NULL,
  time_updated integer NOT NULL,
  data text NOT NULL
);

CREATE TABLE part (
  id text PRIMARY KEY,
  message_id text NOT NULL,
  session_id text NOT NULL,
  time_created integer NOT NULL,
  time_updated integer NOT NULL,
  data text NOT NULL
);
```

Unlike Codex, there is no separate JSONL registry to update. If the SQLite rows are valid, the session appears in the OpenCode TUI.

## IDs and Timestamps

### ID Shapes

OpenCode commonly uses prefixed IDs:

- Session: `ses_<hex+random>`
- Message: `msg_<hex+random>`
- Part: `prt_<hex+random>`

synctx generates IDs in that same style.

### Timestamp Format

OpenCode stores times as Unix milliseconds.

Example:

```json
{"time":{"created":1773556847003}}
```

Using seconds instead of milliseconds would place imported records at the wrong time and break ordering.

## Data Model

### Two Layers Per Message

OpenCode splits each turn into:

1. `message.data` — role metadata and session graph fields
2. `part.data` — actual renderable content blocks

Both are required.

If you only write `message.data`, the session may exist in the database but there will be nothing usable to render.

If you only write `part.data`, there is no valid role/message metadata to reconstruct the conversation.

### Session Row

A minimal working imported session needs:

```json
{
  "id": "ses_...",
  "project_id": "<project-id>",
  "slug": "",
  "directory": "/absolute/project/path",
  "title": "First user message...",
  "version": "0.0.0",
  "time_created": 1773559852182,
  "time_updated": 1773559852182,
  "time_archived": null
}
```

Notes:

- `directory` should be the target project path.
- `title` can be derived from the first user message and truncated.
- synctx now tries to inherit `slug` and `version` from a recent native session for the same project when available.

### Project Row

Each session references a `project_id`, so the project row must exist first.

synctx derives `project.id` from the repository root commit hash:

```bash
git rev-list --max-parents=0 HEAD
```

If that fails, it falls back to a deterministic hash of the project path.

## Message Format

### User Message

Observed minimal working shape:

```json
{
  "role": "user",
  "time": {"created": 1773556847003},
  "summary": {
    "title": "Investigate why resume is broken",
    "diffs": []
  },
  "agent": "build",
  "model": {
    "providerID": "openai",
    "modelID": "gpt-5.2"
  }
}
```

Optional real-world fields such as `variant` may also appear.

### Assistant Message

Observed minimal working shape:

```json
{
  "role": "assistant",
  "time": {
    "created": 1773556858757,
    "completed": 1773556858757
  },
  "parentID": "msg_...",
  "modelID": "gpt-5.2",
  "providerID": "openai",
  "mode": "build",
  "agent": "build",
  "path": {
    "cwd": "/absolute/project/path",
    "root": "/absolute/project/path"
  },
  "cost": 0,
  "tokens": {
    "input": 0,
    "output": 0,
    "reasoning": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  },
  "finish": "stop"
}
```

### Renderable Part

Each message also needs at least one `part` row:

```json
{
  "type": "text",
  "text": "I traced the failure to the writer format.",
  "time": {
    "start": 1773556858757,
    "end": 1773556858757
  }
}
```

synctx currently writes one text part per normalized message.

## Critical Content Shape Rules

### Assistant Metadata Is Not Optional

This was the main failure mode discovered during debugging.

If assistant `message.data` is missing fields like `agent`, OpenCode can still show the session in the TUI list, but opening the session crashes the detail view.

Observed error:

```text
TypeError: undefined is not an object (evaluating 'str3.replace')
```

The stack pointed into OpenCode's title-casing helper, which strongly implied the UI was trying to format a missing string field. In practice, the missing field was `msg.agent`.

### `parentID` Should Link to the Latest User Message

For imported linear conversations, assistant messages should usually point to the most recent user message:

- first assistant: `parentID = <first-user-msg-id>`
- later assistants: `parentID = <latest-user-msg-id>`

Linking assistants only to the previous assistant can produce a valid graph shape for storage, but does not match the native OpenCode structure as closely.

### Message Text Lives in `part.data.text`

The OpenCode reader in synctx reconstructs history by joining:

- `message.data.role`
- `part.data.text`

That means imported sessions should always create both rows together.

## Minimal Import Strategy Used by synctx

synctx currently writes the smallest structure that OpenCode will open cleanly:

1. Open `~/.local/share/opencode/opencode.db`
2. Ensure a `project` row exists for the target worktree
3. Create a `session` row
4. For each normalized message:
   - create a `message` row
   - create a matching text `part` row
   - keep timestamps in milliseconds
5. Reuse recent native metadata defaults when available:
   - user `agent`
   - user `model`
   - assistant `agent`
   - assistant `mode`
   - assistant `providerID`
   - assistant `modelID`
   - assistant `path`
   - session `slug`
   - session `version`
6. Resume with:

```bash
opencode -s <session-id>
```

## Reading Sessions

synctx's OpenCode reader currently does the following:

1. Query unarchived rows from `session`
2. Count related `message` rows
3. Read message content by joining `message` and `part`
4. Parse:
   - role from `message.data.role`
   - text from `part.data.text`

That means:

- `session.title` is what appears in the session list
- `session.directory` is used as the project path
- empty or malformed `part.data.text` rows are skipped

## Resume Behavior

OpenCode can jump directly into a session by ID:

```bash
opencode -s <session-id>
```

This is the command synctx should generate for OpenCode resumes.

Using bare `opencode` only opens the TUI home screen rather than the target conversation.

## Checklist for Writing an OpenCode Session

1. Open `opencode.db`
2. Ensure a `project` row exists for the target directory
3. Generate a `ses_...` session ID
4. Insert a `session` row with:
   - `project_id`
   - `directory`
   - `title`
   - `slug`
   - `version`
   - `time_created`
   - `time_updated`
5. For each message, generate a `msg_...` ID and insert `message.data`
6. For each message, generate a `prt_...` ID and insert a matching text `part.data`
7. For assistant messages, include:
   - `agent`
   - `providerID`
   - `modelID`
   - `mode`
   - `path`
   - `cost`
   - `tokens`
   - `finish`
   - `parentID`
8. Keep all timestamps in milliseconds
9. Resume with `opencode -s <session-id>`
