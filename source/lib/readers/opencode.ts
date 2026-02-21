import {type SessionReader} from './types.js';

// TODO: discover OpenCode session file format and implement
export const opencodeReader: SessionReader = {
	agentName: 'OpenCode',
	readSessions: () => [],
};
