import {type NormalizedSession, type WriteResult, type SessionWriter} from '../types.js';

// Claude Code session format:
// ~/.claude/projects/<encoded-path>/<session-id>.jsonl
// Each line: { uuid, parentUuid, timestamp, sessionId, type, message: { role, content } }
// Resume with: claude --resume <session-id>

export const claudeCodeWriter: SessionWriter = {
	agentName: 'Claude Code',

	async writeSession(
		_session: NormalizedSession,
		_targetProjectPath: string,
	): Promise<WriteResult> {
		// TODO: implement
		// 1. Encode targetProjectPath to dir name (replace / with -)
		// 2. Generate new sessionId (UUID)
		// 3. Build JSONL lines with uuid/parentUuid chain
		// 4. Write to ~/.claude/projects/<encoded>/<sessionId>.jsonl
		throw new Error('Not implemented');
	},
};
