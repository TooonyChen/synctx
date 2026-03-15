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

type UserMessageDefaults = {
	agent: string;
	model: {
		providerID: string;
		modelID: string;
	};
	variant?: string;
};

type AssistantMessageDefaults = {
	agent: string;
	mode: string;
	providerID: string;
	modelID: string;
	path: {
		cwd: string;
		root: string;
	};
};

type SessionDefaults = {
	version: string;
	slug: string;
	user: UserMessageDefaults;
	assistant: AssistantMessageDefaults;
};

type UserMessageSeed = {
	agent?: string;
	model?: {providerID?: string; modelID?: string};
	variant?: string;
};

type AssistantMessageSeed = {
	agent?: string;
	mode?: string;
	providerID?: string;
	modelID?: string;
	path?: {cwd?: string; root?: string};
};

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

function summarizeUserMessage(content: string): string {
	return content.replace(/\n+/g, ' ').trim().slice(0, 60);
}

function loadSessionDefaults(db: Database, targetProjectPath: string): SessionDefaults {
	const base: SessionDefaults = {
		version: '0.0.0',
		slug: '',
		user: {
			agent: 'build',
			model: {
				providerID: 'openai',
				modelID: 'gpt-5.2',
			},
		},
		assistant: {
			agent: 'build',
			mode: 'build',
			providerID: 'openai',
			modelID: 'gpt-5.2',
			path: {
				cwd: targetProjectPath,
				root: targetProjectPath,
			},
		},
	};

	const sessionRow = db
		.prepare(
			`SELECT id, slug, version
			 FROM session
			 WHERE directory = ? AND time_archived IS NULL
			 ORDER BY time_updated DESC
			 LIMIT 1`,
		)
		.get(targetProjectPath) as
		| {
				id: string;
				slug: string;
				version: string;
		  }
		| undefined;

	const fallbackSessionRow =
		sessionRow ??
		(db
			.prepare(
				`SELECT id, slug, version
				 FROM session
				 WHERE time_archived IS NULL
				 ORDER BY time_updated DESC
				 LIMIT 1`,
			)
			.get() as
			| {
					id: string;
					slug: string;
					version: string;
			  }
			| undefined);

	if (!fallbackSessionRow) return base;

	const messageRows = db
		.prepare(
			`SELECT data
			 FROM message
			 WHERE session_id = ?
			 ORDER BY time_created DESC`,
		)
		.all(fallbackSessionRow.id) as Array<{data: string}>;

	let lastUser: UserMessageSeed | undefined;
	let lastAssistant: AssistantMessageSeed | undefined;

	for (const row of messageRows) {
		let data: {role?: string} & Record<string, unknown>;
		try {
			data = JSON.parse(row.data) as {role?: string} & Record<string, unknown>;
		} catch {
			continue;
		}

		if (!lastUser && data.role === 'user') {
			lastUser = data as UserMessageSeed;
		}

		if (!lastAssistant && data.role === 'assistant') {
			lastAssistant = data as AssistantMessageSeed;
		}

		if (lastUser && lastAssistant) break;
	}

	return {
		version: fallbackSessionRow.version || base.version,
		slug: fallbackSessionRow.slug || base.slug,
		user: {
			agent: lastUser?.agent || lastAssistant?.agent || base.user.agent,
			model: {
				providerID:
					lastUser?.model?.providerID ||
					lastAssistant?.providerID ||
					base.user.model.providerID,
				modelID:
					lastUser?.model?.modelID ||
					lastAssistant?.modelID ||
					base.user.model.modelID,
			},
			variant: lastUser?.variant || undefined,
		},
		assistant: {
			agent: lastAssistant?.agent || lastUser?.agent || base.assistant.agent,
			mode: lastAssistant?.mode || lastUser?.agent || base.assistant.mode,
			providerID:
				lastAssistant?.providerID ||
				lastUser?.model?.providerID ||
				base.assistant.providerID,
			modelID:
				lastAssistant?.modelID ||
				lastUser?.model?.modelID ||
				base.assistant.modelID,
			path: {
				cwd: targetProjectPath,
				root:
					lastAssistant?.path?.root ||
					lastAssistant?.path?.cwd ||
					targetProjectPath,
			},
		},
	};
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
			const defaults = loadSessionDefaults(db, targetProjectPath);

			// Derive title from first user message
			const firstUserMsg = session.messages.find(m => m.role === 'user');
			const title = firstUserMsg
				? summarizeUserMessage(firstUserMsg.content)
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
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
				).run(
					sessionId,
					projectId,
					defaults.slug,
					targetProjectPath,
					title,
					defaults.version,
					now,
					now,
				);

				// 3. Insert messages and parts
				let previousMsgId: string | null = null;
				let lastUserMsgId: string | null = null;

				for (const msg of session.messages) {
					const msgId = generateId('msg_');
					const partId = generateId('prt_');
					const msgTime = msg.timestamp.getTime();

					const msgData =
						msg.role === 'user'
							? JSON.stringify({
									role: 'user',
									time: {created: msgTime},
									summary: {
										title: summarizeUserMessage(msg.content),
										diffs: [],
									},
									agent: defaults.user.agent,
									model: defaults.user.model,
									...(defaults.user.variant
										? {variant: defaults.user.variant}
										: {}),
							  })
							: JSON.stringify({
									role: 'assistant',
									time: {created: msgTime, completed: msgTime},
									parentID: lastUserMsgId ?? previousMsgId ?? msgId,
									modelID: defaults.assistant.modelID,
									providerID: defaults.assistant.providerID,
									mode: defaults.assistant.mode,
									agent: defaults.assistant.agent,
									path: defaults.assistant.path,
									cost: 0,
									tokens: {
										input: 0,
										output: 0,
										reasoning: 0,
										cache: {read: 0, write: 0},
									},
									finish: 'stop',
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

					if (msg.role === 'user') {
						lastUserMsgId = msgId;
					}

					previousMsgId = msgId;
				}
			});

			transaction();

			return {
				sessionId,
				resumeCommand: `opencode -s ${sessionId}`,
			};
		} finally {
			db.close();
		}
	},
};
