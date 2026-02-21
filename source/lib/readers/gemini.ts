import {type SessionReader} from './types.js';

// TODO: discover Gemini CLI session file format and implement
export const geminiReader: SessionReader = {
	agentName: 'Gemini CLI',
	readSessions: () => [],
};
