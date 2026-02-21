import {claudeCodeReader} from './claudeCode.js';
import {codexReader} from './codex.js';
import {geminiReader} from './gemini.js';
import {opencodeReader} from './opencode.js';
import {type Session, type SessionReader} from './types.js';

export {type Session, type SessionReader} from './types.js';

const ALL_READERS: SessionReader[] = [
	claudeCodeReader,
	codexReader,
	geminiReader,
	opencodeReader,
];

export function readAllSessions(): Session[] {
	return ALL_READERS.flatMap(r => r.readSessions()).sort(
		(a, b) => b.lastActive.getTime() - a.lastActive.getTime(),
	);
}
