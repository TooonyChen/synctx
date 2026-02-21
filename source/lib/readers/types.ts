export type Session = {
	sessionId: string;
	agentName: string;
	projectPath: string;
	projectName: string;
	title: string;
	messageCount: number;
	lastActive: Date;
	createdAt: Date;
};

export interface SessionReader {
	agentName: string;
	readSessions(): Session[];
}
