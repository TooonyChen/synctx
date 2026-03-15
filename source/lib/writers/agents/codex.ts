import {mkdirSync, writeFileSync, appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {Database} from 'bun:sqlite';
import {
	type NormalizedSession,
	type WriteResult,
	type SessionWriter,
} from '../types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const SESSIONS_DIR = resolvePath(AGENT_PATHS.codex.sessionsDir);
const CODEX_HOME = join(homedir(), '.codex');

function extractTitle(session: NormalizedSession): string {
	const firstUser = session.messages.find(m => m.role === 'user');
	if (!firstUser) return 'Synced session';
	return firstUser.content.replace(/\n+/g, ' ').trim().slice(0, 60) || 'Synced session';
}

function registerInIndex(sessionId: string, title: string, now: Date): void {
	const indexPath = join(CODEX_HOME, 'session_index.jsonl');
	const entry = JSON.stringify({
		id: sessionId,
		thread_name: title,
		updated_at: now.toISOString(),
	});
	appendFileSync(indexPath, entry + '\n', 'utf8');
}

function registerInSqlite(
	sessionId: string,
	rolloutPath: string,
	title: string,
	cwd: string,
	firstUserMessage: string,
	now: Date,
): void {
	const dbPath = join(CODEX_HOME, 'state_5.sqlite');
	let db: InstanceType<typeof Database>;
	try {
		db = new Database(dbPath);
	} catch {
		// SQLite DB may not exist yet; skip registration
		return;
	}

	try {
		const nowSec = Math.floor(now.getTime() / 1000);
		db.run(
			`INSERT OR IGNORE INTO threads
				(id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
				 sandbox_policy, approval_mode, cli_version, first_user_message, memory_mode)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				sessionId,
				rolloutPath,
				nowSec,
				nowSec,
				'cli',
				'openai',
				cwd,
				title,
				JSON.stringify({type: 'read-only'}),
				'on-request',
				'synctx',
				firstUserMessage,
				'enabled',
			],
		);
	} finally {
		db.close();
	}
}

export const codexWriter: SessionWriter = {
	agentName: 'Codex',

	async writeSession(
		session: NormalizedSession,
		targetProjectPath: string,
	): Promise<WriteResult> {
		const sessionId = randomUUID();
		const now = new Date();

		// Build date-based directory: YYYY/MM/DD
		const year = String(now.getFullYear());
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const dateDir = join(SESSIONS_DIR, year, month, day);

		// Filename: rollout-<ISO-no-colons>-<uuid>.jsonl
		const isoNoColons = now.toISOString().replaceAll(':', '-');
		const filePath = join(dateDir, `rollout-${isoNoColons}-${sessionId}.jsonl`);

		mkdirSync(dateDir, {recursive: true});

		const lines: string[] = [];
		const isoTimestamp = now.toISOString();

		// Line 1: session_meta
		lines.push(
			JSON.stringify({
				timestamp: isoTimestamp,
				type: 'session_meta',
				payload: {
					id: sessionId,
					timestamp: isoTimestamp,
					cwd: targetProjectPath,
					originator: 'synctx',
					cli_version: '0.1.0',
					instructions: null,
					source: 'cli',
					model_provider: 'openai',
					git: null,
				},
			}),
		);

		// Write messages as response_items (for model context) + event_msgs (for TUI display)
		// Group into turns: each user message + following assistant message = one turn
		let i = 0;
		while (i < session.messages.length) {
			const msg = session.messages[i]!;
			const ts = msg.timestamp.toISOString();

			if (msg.role === 'user') {
				const turnId = randomUUID();

				// task_started
				lines.push(
					JSON.stringify({
						timestamp: ts,
						type: 'event_msg',
						payload: {type: 'task_started', turn_id: turnId},
					}),
				);

				// response_item for model context
				lines.push(
					JSON.stringify({
						timestamp: ts,
						type: 'response_item',
						payload: {
							type: 'message',
							role: 'user',
							content: [{type: 'input_text', text: msg.content}],
						},
					}),
				);

				// event_msg for TUI display
				lines.push(
					JSON.stringify({
						timestamp: ts,
						type: 'event_msg',
						payload: {type: 'user_message', message: msg.content},
					}),
				);

				// Check if next message is assistant response
				const next = session.messages[i + 1];
				if (next?.role === 'assistant') {
					const nextTs = next.timestamp.toISOString();

					lines.push(
						JSON.stringify({
							timestamp: nextTs,
							type: 'response_item',
							payload: {
								type: 'message',
								role: 'assistant',
								content: [{type: 'output_text', text: next.content}],
							},
						}),
					);

					lines.push(
						JSON.stringify({
							timestamp: nextTs,
							type: 'event_msg',
							payload: {type: 'agent_message', message: next.content},
						}),
					);

					lines.push(
						JSON.stringify({
							timestamp: nextTs,
							type: 'event_msg',
							payload: {
								type: 'task_complete',
								turn_id: turnId,
								last_agent_message: next.content,
							},
						}),
					);

					i += 2;
				} else {
					// No assistant reply, close the turn
					lines.push(
						JSON.stringify({
							timestamp: ts,
							type: 'event_msg',
							payload: {type: 'task_complete', turn_id: turnId},
						}),
					);
					i++;
				}
			} else {
				// Standalone assistant message (shouldn't happen often)
				lines.push(
					JSON.stringify({
						timestamp: ts,
						type: 'response_item',
						payload: {
							type: 'message',
							role: 'assistant',
							content: [{type: 'output_text', text: msg.content}],
						},
					}),
				);
				i++;
			}
		}

		writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');

		// Register session so Codex can discover it
		const title = extractTitle(session);
		const firstUserMessage = session.messages.find(m => m.role === 'user')?.content ?? '';

		registerInIndex(sessionId, title, now);
		registerInSqlite(sessionId, filePath, title, targetProjectPath, firstUserMessage, now);

		return {
			sessionId,
			resumeCommand: `codex resume ${sessionId}`,
		};
	},
};
