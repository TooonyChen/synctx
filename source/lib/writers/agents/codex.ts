import {type NormalizedSession, type WriteResult, type SessionWriter} from '../types.js';

// Codex session format:
// ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl
// First line: { timestamp, type: "session_meta", payload: { id, cwd, timestamp, cli_version, ... } }
// Messages: { timestamp, type: "response_item", payload: { role: "user"|"assistant", content: [{type, text}] } }
// Resume with: codex resume <session-id>

export const codexWriter: SessionWriter = {
	agentName: 'Codex',

	async writeSession(
		_session: NormalizedSession,
		_targetProjectPath: string,
	): Promise<WriteResult> {
		// TODO: implement
		// 1. Generate new sessionId (UUID) and timestamp
		// 2. Create YYYY/MM/DD directory under ~/.codex/sessions/
		// 3. Write session_meta line
		// 4. Write response_item lines for each message
		throw new Error('Not implemented');
	},
};
