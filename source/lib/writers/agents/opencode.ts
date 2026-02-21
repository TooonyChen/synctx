import {type NormalizedSession, type WriteResult, type SessionWriter} from '../types.js';

// OpenCode session storage:
// ~/.local/share/opencode/opencode.db (SQLite)
// Tables: session (id, title, directory, time_created, time_updated)
//         message (id, session_id, time_created, time_updated, data JSON)
// Native import: opencode import <file> (JSON format from opencode export)
// Resume with: opencode (picks up last session, or use session picker)

export const opencodeWriter: SessionWriter = {
	agentName: 'OpenCode',

	async writeSession(
		_session: NormalizedSession,
		_targetProjectPath: string,
	): Promise<WriteResult> {
		// TODO: implement
		// Option A (preferred): write directly to opencode.db
		//   - INSERT into session table with new id, title from source, directory = targetProjectPath
		//   - INSERT messages into message table with data JSON matching OpenCode's schema
		// Option B: use `opencode export` to understand JSON format, then `opencode import`
		throw new Error('Not implemented');
	},
};
