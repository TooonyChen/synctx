import {claudeCodeReader} from './agents/claudeCode.js';
import {codexReader} from './agents/codex.js';
import {geminiReader} from './agents/gemini.js';
import {opencodeReader} from './agents/opencode.js';
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
