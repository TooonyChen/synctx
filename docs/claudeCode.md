# Claude Code Session Format & Integration Notes

Claude Code stores sessions as JSONL files under a project-scoped directory. This document captures the practical details and gotchas discovered while building synctx's Claude Code reader/writer.

## Session Storage

### File Location

```text
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl
```

- Project directories are derived from the absolute path with `/` replaced by `-`.
- Example:
  - Project path: `/Users/okcomputer/codebase/synctx`
  - Encoded dir: `-Users-okcomputer-codebase-synctx`
- Filename is the session UUID with a `.jsonl` extension.

### Real Session Layout

Real Claude Code sessions often have more than just the root JSONL file:

```text
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl
~/.claude/projects/<encoded-project-path>/<session-id>/subagents/...
~/.claude/projects/<encoded-project-path>/<session-id>/tool-results/...
```

- `subagents/` contains spawned agent transcripts and metadata.
- `tool-results/` contains captured tool output blobs.

**Important:** a minimal imported session does not need these companion directories. synctx can write only the root JSONL file and `claude --resume <session-id>` still works for text-only history.

## JSONL Format

### Two Observed Shapes

Claude Code sessions in the wild contain two broad categories of entries:

1. `file-history-snapshot`
2. Conversation entries with `type: "user"` or `type: "assistant"`

Real sessions usually begin with a snapshot line:

```json
{
  "type": "file-history-snapshot",
  "messageId": "<uuid>",
  "snapshot": {
    "messageId": "<uuid>",
    "trackedFileBackups": {},
    "timestamp": "<ISO-8601>"
  },
  "isSnapshotUpdate": false
}
```

synctx's minimal writer currently omits this snapshot entry, and Claude Code still accepts the session.

### Minimal Working Conversation Entry

Each conversation line needs these top-level fields:

```json
{
  "uuid": "<uuid>",
  "parentUuid": "<previous-uuid-or-null>",
  "isSidechain": false,
  "userType": "external",
  "cwd": "<absolute-project-path>",
  "sessionId": "<session-uuid>",
  "type": "user|assistant",
  "message": {
    "role": "user|assistant",
    "content": "..."
  },
  "timestamp": "<ISO-8601>"
}
```

### Parent Chain

Claude Code expects entries to be linked:

- First message: `parentUuid: null`
- Each following message: `parentUuid` points to the previous entry's `uuid`

synctx writes a linear chain for imported sessions.

## Critical Content Shape Rules

### User Messages

For simple imported history, user messages can be written as a plain string:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "Please investigate this bug"
  }
}
```

Claude Code also emits array-shaped content for some user events in real sessions, but plain strings are sufficient for a minimal import.

### Assistant Messages

This is the most important constraint discovered during debugging:

**Assistant messages must be written as a content block array, not a plain string.**

Correct:

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {"type": "text", "text": "I investigated the issue."}
    ]
  }
}
```

Incorrect:

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": "I investigated the issue."
  }
}
```

### Failure Mode

When assistant messages were serialized as strings, `claude --resume <session-id>` failed on real imported sessions with:

```text
Failed to resume session: q.message.content.find is not a function
```

That error strongly suggests Claude Code assumes assistant `message.content` is always an array and calls `.find(...)` on it while reconstructing the session.

## Minimal Import Strategy Used by synctx

synctx currently writes the smallest structure that Claude Code will resume:

1. Create `~/.claude/projects/<encoded-project-path>/`
2. Generate a new session UUID
3. Write `<session-id>.jsonl`
4. For each normalized message:
   - generate a `uuid`
   - link `parentUuid`
   - set `cwd`, `sessionId`, `timestamp`
   - write user content as string
   - write assistant content as `[{type:"text", text:"..."}]`
5. Resume with:

```bash
claude --resume <session-id>
```

## Reading Sessions

### Directory Walk

Sessions can be discovered by scanning:

```text
~/.claude/projects/*/*.jsonl
```

Each immediate child of `~/.claude/projects/` is a project directory, and each `*.jsonl` file inside it is a top-level session transcript.

### Snapshot Entries

Readers should skip `type: "file-history-snapshot"` when:

- counting messages
- extracting titles
- reconstructing chat history

### Title Extraction

The first user message is a good title source.

In synctx, the reader:

- takes the first `type: "user"` entry
- extracts text from `message.content`
- strips image filenames like `foo.png`
- collapses newlines
- truncates to 60 chars

## Resume Behavior

### Direct Resume

Claude Code accepts a session UUID directly:

```bash
claude --resume <session-id>
```

This worked for:

- native Claude Code sessions
- minimal synctx-generated text-only sessions

### Registry Behavior

Unlike Codex, no separate SQLite or JSONL index was required for the tested import flow. The root session JSONL file was enough for direct resume by session ID.

## Checklist for Writing a Claude Code Session

1. Encode the project path by replacing `/` with `-`
2. Create `~/.claude/projects/<encoded-project-path>/`
3. Generate a new session UUID
4. Write `<session-id>.jsonl`
5. For each message, include:
   - `uuid`
   - `parentUuid`
   - `isSidechain: false`
   - `userType: "external"`
   - `cwd`
   - `sessionId`
   - `type`
   - `message.role`
   - `timestamp`
6. Serialize user content as a string
7. Serialize assistant content as an array of text blocks
8. Resume with `claude --resume <session-id>`
