import {type Session} from '../readers/types.js';

export type NormalizedMessage = {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
};

export type NormalizedSession = {
	source: Session;
	messages: NormalizedMessage[];
};

export type WriteResult = {
	sessionId: string;
	resumeCommand: string; // e.g. "claude --resume abc123"
};

export interface SessionWriter {
	agentName: string;
	writeSession(
		session: NormalizedSession,
		targetProjectPath: string,
	): Promise<WriteResult>;
}
