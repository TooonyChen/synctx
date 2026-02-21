import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, basename} from 'node:path';
import {type Session, type SessionReader} from '../types.js';
import {type NormalizedMessage} from '../../writers/types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const SESSIONS_DIR = resolvePath(AGENT_PATHS.claudeCode.sessionsDir);

type RawEntry = {
	type: string;
	sessionId?: string;
	cwd?: string;
	timestamp?: string;
	message?: {
		role?: string;
		content?: string | Array<{type: string; text?: string}>;
	};
};

function parseSessionFile(filePath: string): Session | null {
	let raw: string;
	try {
		raw = readFileSync(filePath, 'utf8');
	} catch {
		return null;
	}

	const lines = raw.trim().split('\n').filter(Boolean);
	if (lines.length === 0) return null;

	let sessionId = basename(filePath, '.jsonl');
	let projectPath = '';
	let firstUserText = '';
	let createdAt: Date | null = null;
	let lastActive: Date | null = null;
	let messageCount = 0;

	for (const line of lines) {
		let entry: RawEntry;
		try {
			entry = JSON.parse(line) as RawEntry;
		} catch {
			continue;
		}

		if (entry.type === 'file-history-snapshot') continue;

		if (entry.sessionId) sessionId = entry.sessionId;
		if (entry.cwd && !projectPath) projectPath = entry.cwd;

		if (entry.timestamp) {
			const ts = new Date(entry.timestamp);
			if (!createdAt || ts < createdAt) createdAt = ts;
			if (!lastActive || ts > lastActive) lastActive = ts;
		}

		if (entry.type === 'user' || entry.type === 'assistant') {
			messageCount++;
		}

		if (entry.type === 'user' && !firstUserText && entry.message?.content) {
			const content = entry.message.content;
			if (typeof content === 'string') {
				firstUserText = content;
			} else if (Array.isArray(content)) {
				firstUserText = content
					.filter(c => c.type === 'text' && c.text)
					.map(c => c.text!)
					.join(' ');
			}
		}
	}

	if (!projectPath) return null;

	const title = firstUserText
		.replace(/\S+\.(png|jpg|jpeg|gif|webp|svg)\n?/gi, '')
		.replace(/\n+/g, ' ')
		.trim()
		.slice(0, 60) || basename(projectPath);

	return {
		sessionId,
		agentName: 'Claude Code',
		projectPath,
		projectName: basename(projectPath),
		title,
		messageCount,
		lastActive: lastActive ?? new Date(statSync(filePath).mtimeMs),
		createdAt: createdAt ?? new Date(statSync(filePath).birthtimeMs),
		sourcePath: filePath,
	};
}

export function readMessages(session: Session): NormalizedMessage[] {
	let raw: string;
	try {
		raw = readFileSync(session.sourcePath, 'utf8');
	} catch {
		return [];
	}

	const messages: NormalizedMessage[] = [];

	for (const line of raw.trim().split('\n').filter(Boolean)) {
		let entry: RawEntry;
		try {
			entry = JSON.parse(line) as RawEntry;
		} catch {
			continue;
		}

		if (entry.type !== 'user' && entry.type !== 'assistant') continue;
		if (!entry.message?.content) continue;

		const content = entry.message.content;
		let text = '';
		if (typeof content === 'string') {
			text = content;
		} else if (Array.isArray(content)) {
			text = content
				.filter(c => c.type === 'text' && c.text)
				.map(c => c.text!)
				.join('\n');
		}

		if (!text.trim()) continue;

		messages.push({
			role: entry.type === 'user' ? 'user' : 'assistant',
			content: text,
			timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
		});
	}

	return messages;
}

export const claudeCodeReader: SessionReader = {
	agentName: 'Claude Code',

	readSessions(): Session[] {
		if (!existsSync(SESSIONS_DIR)) return [];

		const sessions: Session[] = [];

		for (const dirName of readdirSync(SESSIONS_DIR)) {
			const dirPath = join(SESSIONS_DIR, dirName);
			let files: string[];
			try {
				files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
			} catch {
				continue;
			}

			for (const file of files) {
				const session = parseSessionFile(join(dirPath, file));
				if (session) sessions.push(session);
			}
		}

		return sessions;
	},
};
