import {claudeCodeReader} from './agents/claudeCode.js';
import {readMessages as readClaudeCode} from './agents/claudeCode.js';
import {codexReader} from './agents/codex.js';
import {readMessages as readCodex} from './agents/codex.js';
import {opencodeReader} from './agents/opencode.js';
import {readMessages as readOpencode} from './agents/opencode.js';
import {type Session, type SessionReader} from './types.js';
import {type NormalizedMessage} from '../writers/types.js';

export {type Session, type SessionReader} from './types.js';

const ALL_READERS: SessionReader[] = [
	claudeCodeReader,
	codexReader,
	opencodeReader,
];

const MESSAGE_READERS: Record<string, (s: Session) => NormalizedMessage[]> = {
	'Claude Code': readClaudeCode,
	Codex: readCodex,
	OpenCode: readOpencode,
};

export function readAllSessions(): Session[] {
	return ALL_READERS.flatMap(r => r.readSessions()).sort(
		(a, b) => b.lastActive.getTime() - a.lastActive.getTime(),
	);
}

export function readSessionMessages(session: Session): NormalizedMessage[] {
	const reader = MESSAGE_READERS[session.agentName];
	return reader?.(session) ?? [];
}
