import {existsSync} from 'node:fs';
import {basename} from 'node:path';
import {execSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {Database} from 'bun:sqlite';
import {
	type NormalizedSession,
	type WriteResult,
	type SessionWriter,
} from '../types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const DB_PATH = resolvePath(AGENT_PATHS.opencode.dbPath);

/**
 * Generate an OpenCode-style ID: <prefix><hex(timestamp)><random>
 */
function generateId(prefix: string): string {
	const hex = Date.now().toString(16);
	const random = randomUUID().replaceAll('-', '').slice(0, 14);
	return `${prefix}${hex}${random}`;
}

/**
 * Get the project ID by finding the root commit hash, falling back to a
 * deterministic hash of the project path.
 */
function getProjectId(projectPath: string): string {
	try {
		return execSync('git rev-list --max-parents=0 HEAD', {
			cwd: projectPath,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
	} catch {
		// Fallback: use a simple hash of the path
		let hash = 0;
		for (const char of projectPath) {
			hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
		}

		return Math.abs(hash).toString(16).padStart(8, '0');
	}
}

export const opencodeWriter: SessionWriter = {
	agentName: 'OpenCode',

	async writeSession(
		session: NormalizedSession,
		targetProjectPath: string,
	): Promise<WriteResult> {
		if (!existsSync(DB_PATH)) {
			throw new Error(
				`OpenCode database not found at ${DB_PATH}. Is OpenCode installed?`,
			);
		}

		const db = new Database(DB_PATH);
		try {
			const sessionId = generateId('ses_');
			const projectId = getProjectId(targetProjectPath);
			const projectName = basename(targetProjectPath);
			const now = Date.now();

			// Derive title from first user message
			const firstUserMsg = session.messages.find(m => m.role === 'user');
			const title = firstUserMsg
				? firstUserMsg.content.replace(/\n+/g, ' ').trim().slice(0, 60)
				: projectName;

			const transaction = db.transaction(() => {
				// 1. Ensure project exists
				db.prepare(
					`INSERT OR IGNORE INTO project (id, worktree, name, sandboxes, time_created, time_updated)
					 VALUES (?, ?, ?, '[]', ?, ?)`,
				).run(projectId, targetProjectPath, projectName, now, now);

				// 2. Create session
				db.prepare(
					`INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated, time_archived)
					 VALUES (?, ?, '', ?, ?, '0.0.0', ?, ?, NULL)`,
				).run(sessionId, projectId, targetProjectPath, title, now, now);

				// 3. Insert messages and parts
				let previousMsgId: string | null = null;

				for (const msg of session.messages) {
					const msgId = generateId('msg_');
					const partId = generateId('prt_');
					const msgTime = msg.timestamp.getTime();

					const msgData = JSON.stringify({
						role: msg.role,
						time: {created: msgTime},
						parentID: msg.role === 'assistant' ? previousMsgId : null,
						tokens: {input: 0, output: 0, cache: {read: 0, write: 0}},
					});

					db.prepare(
						`INSERT INTO message (id, session_id, time_created, time_updated, data)
						 VALUES (?, ?, ?, ?, ?)`,
					).run(msgId, sessionId, msgTime, msgTime, msgData);

					const partData = JSON.stringify({
						type: 'text',
						text: msg.content,
						time: {start: msgTime, end: msgTime},
					});

					db.prepare(
						`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
						 VALUES (?, ?, ?, ?, ?, ?)`,
					).run(partId, msgId, sessionId, msgTime, msgTime, partData);

					previousMsgId = msgId;
				}
			});

			transaction();

			return {
				sessionId,
				resumeCommand: 'opencode',
			};
		} finally {
			db.close();
		}
	},
};
