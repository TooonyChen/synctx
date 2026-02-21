import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, basename} from 'node:path';
import {type Session, type SessionReader} from '../types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';

const TMP_DIR = resolvePath(AGENT_PATHS.gemini.tmpDir);

type GeminiMessage = {
	id: string;
	timestamp: string;
	type: 'user' | 'gemini';
	content: string | Array<{text: string}>;
};

type GeminiSession = {
	sessionId: string;
	projectHash: string;
	startTime: string;
	lastUpdated: string;
	messages: GeminiMessage[];
};

function readProjectRoot(projectDir: string): string {
	const rootFile = join(projectDir, '.project_root');
	try {
		return readFileSync(rootFile, 'utf8').trim();
	} catch {
		return '';
	}
}

function extractUserText(content: GeminiMessage['content']): string {
	if (typeof content === 'string') return content;
	return content
		.filter(c => c.text)
		.map(c => c.text)
		.join(' ');
}

function parseSessionFile(filePath: string, projectPath: string): Session | null {
	let raw: string;
	try {
		raw = readFileSync(filePath, 'utf8');
	} catch {
		return null;
	}

	let session: GeminiSession;
	try {
		session = JSON.parse(raw) as GeminiSession;
	} catch {
		return null;
	}

	if (!session.sessionId || !Array.isArray(session.messages)) return null;

	const userMessages = session.messages.filter(m => m.type === 'user');
	const firstUserText = userMessages[0]
		? extractUserText(userMessages[0].content)
		: '';

	const messageCount = session.messages.filter(
		m => m.type === 'user' || m.type === 'gemini',
	).length;

	const title = firstUserText.replace(/\n+/g, ' ').trim().slice(0, 60)
		|| basename(projectPath)
		|| basename(filePath, '.json');

	return {
		sessionId: session.sessionId,
		agentName: 'Gemini CLI',
		projectPath,
		projectName: basename(projectPath) || basename(filePath, '.json'),
		title,
		messageCount,
		lastActive: new Date(session.lastUpdated),
		createdAt: new Date(session.startTime),
		sourcePath: filePath,
	};
}

export const geminiReader: SessionReader = {
	agentName: 'Gemini CLI',

	readSessions(): Session[] {
		if (!existsSync(TMP_DIR)) return [];

		const sessions: Session[] = [];

		for (const projectId of readdirSync(TMP_DIR)) {
			const projectDir = join(TMP_DIR, projectId);
			const chatsDir = join(projectDir, 'chats');

			if (!existsSync(chatsDir)) continue;

			const projectPath = readProjectRoot(projectDir);

			let files: string[];
			try {
				files = readdirSync(chatsDir).filter(f => f.endsWith('.json'));
			} catch {
				continue;
			}

			for (const file of files) {
				const session = parseSessionFile(join(chatsDir, file), projectPath);
				if (session) sessions.push(session);
			}
		}

		return sessions;
	},
};
