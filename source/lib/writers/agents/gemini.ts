import {type NormalizedSession, type WriteResult, type SessionWriter} from '../types.js';

// Gemini CLI session format:
// ~/.gemini/tmp/<project-id>/chats/session-<date>-<short-uuid>.json
// project-id = project basename or hash; .project_root file maps to full path
// Format: { sessionId, projectHash, startTime, lastUpdated, messages[] }
// Messages: { id, timestamp, type: "user"|"gemini", content: string | [{text}] }
// Resume with: gemini --resume <session-id>

export const geminiWriter: SessionWriter = {
	agentName: 'Gemini CLI',

	async writeSession(
		_session: NormalizedSession,
		_targetProjectPath: string,
	): Promise<WriteResult> {
		// TODO: implement
		// 1. Derive project-id from targetProjectPath basename
		// 2. Create ~/.gemini/tmp/<project-id>/chats/ if needed
		// 3. Write .project_root file with targetProjectPath
		// 4. Generate new sessionId (UUID) and filename session-<date>-<short-uuid>.json
		// 5. Write JSON with messages (user -> content array, gemini -> content string)
		throw new Error('Not implemented');
	},
};
