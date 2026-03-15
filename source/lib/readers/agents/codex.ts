import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, basename} from 'node:path';
import {type Session, type SessionReader} from '../types.js';
import {type NormalizedMessage} from '../../writers/types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const SESSIONS_DIR = resolvePath(AGENT_PATHS.codex.sessionsDir);

// System-injected user messages to skip when extracting the session title
const SYSTEM_PREFIXES = [
	'<permissions instructions>',
	'<environment_context>',
	'# AGENTS.md instructions for',
	'<INSTRUCTIONS>',
];

type ContentBlock = {type: string; text?: string};

type RawEntry = {
	timestamp?: string;
	type: string;
	payload?: {
		id?: string;
		cwd?: string;
		timestamp?: string;
		role?: string;
		content?: ContentBlock[];
	};
};

function extractText(content: ContentBlock[]): string {
	return content
		.filter(c => c.text)
		.map(c => c.text!)
		.join(' ');
}

function isSystemMessage(text: string): boolean {
	return SYSTEM_PREFIXES.some(prefix => text.trimStart().startsWith(prefix));
}

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

		// Track timestamps
		const ts = entry.timestamp ? new Date(entry.timestamp) : null;
		if (ts) {
			if (!createdAt || ts < createdAt) createdAt = ts;
			if (!lastActive || ts > lastActive) lastActive = ts;
		}

		if (entry.type === 'session_meta' && entry.payload) {
			if (entry.payload.id) sessionId = entry.payload.id;
			if (entry.payload.cwd) projectPath = entry.payload.cwd;
			continue;
		}

		if (entry.type === 'response_item' && entry.payload) {
			const {role, content} = entry.payload;
			if (!content || !Array.isArray(content)) continue;

			if (role === 'user' || role === 'assistant') {
				const text = extractText(content);

				// Skip system-injected user messages
				if (role === 'user' && isSystemMessage(text)) continue;

				messageCount++;

				if (role === 'user' && !firstUserText && text.trim()) {
					firstUserText = text;
				}
			}
		}
	}

	if (!projectPath) return null;

	const title =
		firstUserText.replace(/\n+/g, ' ').trim().slice(0, 60) ||
		basename(projectPath);

	const stat = statSync(filePath);

	return {
		sessionId,
		agentName: 'Codex',
		projectPath,
		projectName: basename(projectPath),
		title,
		messageCount,
		lastActive: lastActive ?? new Date(stat.mtimeMs),
		createdAt: createdAt ?? new Date(stat.birthtimeMs),
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

		if (entry.type !== 'response_item' || !entry.payload) continue;

		const {role, content} = entry.payload;
		if (!content || !Array.isArray(content)) continue;
		if (role !== 'user' && role !== 'assistant') continue;

		const text = extractText(content);
		if (role === 'user' && isSystemMessage(text)) continue;
		if (!text.trim()) continue;

		messages.push({
			role,
			content: text,
			timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
		});
	}

	return messages;
}

export const codexReader: SessionReader = {
	agentName: 'Codex',

	readSessions(): Session[] {
		if (!existsSync(SESSIONS_DIR)) return [];

		const sessions: Session[] = [];

		// Walk YYYY/MM/DD directory structure
		for (const year of readdirSync(SESSIONS_DIR)) {
			const yearPath = join(SESSIONS_DIR, year);
			for (const month of readdirSync(yearPath)) {
				const monthPath = join(yearPath, month);
				for (const day of readdirSync(monthPath)) {
					const dayPath = join(monthPath, day);
					let files: string[];
					try {
						files = readdirSync(dayPath).filter(f => f.endsWith('.jsonl'));
					} catch {
						continue;
					}

					for (const file of files) {
						const session = parseSessionFile(join(dayPath, file));
						if (session) sessions.push(session);
					}
				}
			}
		}

		return sessions;
	},
};
