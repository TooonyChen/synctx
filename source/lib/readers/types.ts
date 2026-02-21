export type Session = {
	sessionId: string;
	agentName: string;
	projectPath: string;
	projectName: string;
	title: string;
	messageCount: number;
	lastActive: Date;
	createdAt: Date;
	// Path to the source file/DB used by writers to read full messages
	sourcePath: string;
};

export interface SessionReader {
	agentName: string;
	readSessions(): Session[];
}
