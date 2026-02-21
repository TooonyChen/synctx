import {type SessionReader} from './types.js';

// TODO: discover Codex session file format and implement
export const codexReader: SessionReader = {
	agentName: 'Codex',
	readSessions: () => [],
};
