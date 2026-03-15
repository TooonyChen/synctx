import {existsSync} from 'node:fs';
import {Database} from 'bun:sqlite';
import {type Session, type SessionReader} from '../types.js';
import {type NormalizedMessage} from '../../writers/types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const DB_PATH = resolvePath(AGENT_PATHS.opencode.dbPath);

type SessionRow = {
	id: string;
	title: string;
	directory: string;
	time_created: number;
	time_updated: number;
	message_count: number;
};

type MessageRow = {
	role_data: string;
	part_data: string;
	time_created: number;
};

export function readMessages(session: Session): NormalizedMessage[] {
	if (!existsSync(DB_PATH)) return [];

	let db: Database;
	try {
		db = new Database(DB_PATH, {readonly: true});
	} catch {
		return [];
	}

	try {
		const rows = db
			.prepare(
				`SELECT m.data AS role_data, p.data AS part_data, m.time_created
				 FROM message m
				 JOIN part p ON p.message_id = m.id
				 WHERE m.session_id = ?
				 ORDER BY m.time_created`,
			)
			.all(session.sessionId) as MessageRow[];

		const messages: NormalizedMessage[] = [];

		for (const row of rows) {
			let msgData: {role?: string};
			let partData: {text?: string};
			try {
				msgData = JSON.parse(row.role_data) as {role?: string};
				partData = JSON.parse(row.part_data) as {text?: string};
			} catch {
				continue;
			}

			const role = msgData.role;
			if (role !== 'user' && role !== 'assistant') continue;
			if (!partData.text?.trim()) continue;

			messages.push({
				role,
				content: partData.text,
				timestamp: new Date(row.time_created),
			});
		}

		return messages;
	} finally {
		db.close();
	}
}

export const opencodeReader: SessionReader = {
	agentName: 'OpenCode',

	readSessions(): Session[] {
		if (!existsSync(DB_PATH)) return [];

		let db: Database;
		try {
			db = new Database(DB_PATH, {readonly: true});
		} catch {
			return [];
		}

		try {
			const rows = db
				.prepare(
					`SELECT
            s.id,
            s.title,
            s.directory,
            s.time_created,
            s.time_updated,
            COUNT(m.id) AS message_count
          FROM session s
          LEFT JOIN message m ON m.session_id = s.id
          WHERE s.time_archived IS NULL
          GROUP BY s.id
          ORDER BY s.time_updated DESC`,
				)
				.all() as SessionRow[];

			return rows.map(row => {
				const projectPath = row.directory ?? '';
				const projectName = projectPath.split('/').pop() ?? projectPath;

				return {
					sessionId: row.id,
					agentName: 'OpenCode',
					projectPath,
					projectName,
					title: row.title || projectName,
					messageCount: row.message_count,
					lastActive: new Date(row.time_updated),
					createdAt: new Date(row.time_created),
					sourcePath: DB_PATH,
				};
			});
		} finally {
			db.close();
		}
	},
};
