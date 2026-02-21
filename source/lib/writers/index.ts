import {claudeCodeWriter} from './agents/claudeCode.js';
import {codexWriter} from './agents/codex.js';
import {opencodeWriter} from './agents/opencode.js';
import {geminiWriter} from './agents/gemini.js';
import {type SessionWriter} from './types.js';

export {type NormalizedMessage, type NormalizedSession, type WriteResult, type SessionWriter} from './types.js';

const ALL_WRITERS: SessionWriter[] = [
	claudeCodeWriter,
	codexWriter,
	opencodeWriter,
	geminiWriter,
];

export function getWriter(agentName: string): SessionWriter | undefined {
	return ALL_WRITERS.find(w => w.agentName === agentName);
}
