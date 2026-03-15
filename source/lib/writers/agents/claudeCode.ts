import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {type NormalizedSession, type WriteResult, type SessionWriter} from '../types.js';
import {resolvePath, AGENT_PATHS} from '../../platforms.js';
import {getResumeCommand} from '../../resume.js';

const SESSIONS_DIR = resolvePath(AGENT_PATHS.claudeCode.sessionsDir);

type ClaudeTextBlock = {
	type: 'text';
	text: string;
};

// "/Users/okcomputer/codebase/synctx" → "-Users-okcomputer-codebase-synctx"
function encodeProjectPath(projectPath: string): string {
	return projectPath.replace(/\//g, '-');
}

export const claudeCodeWriter: SessionWriter = {
	agentName: 'Claude Code',

	async writeSession(
		session: NormalizedSession,
		targetProjectPath: string,
	): Promise<WriteResult> {
		const sessionId = randomUUID();
		const projectDir = join(SESSIONS_DIR, encodeProjectPath(targetProjectPath));
		const filePath = join(projectDir, `${sessionId}.jsonl`);

		mkdirSync(projectDir, {recursive: true});

		const lines: string[] = [];
		let previousUuid: string | null = null;

		for (const msg of session.messages) {
			const uuid = randomUUID();
			const content =
				msg.role === 'assistant'
					? ([{type: 'text', text: msg.content}] satisfies ClaudeTextBlock[])
					: msg.content;

			lines.push(
				JSON.stringify({
					uuid,
					parentUuid: previousUuid,
					isSidechain: false,
					userType: 'external',
					cwd: targetProjectPath,
					sessionId,
					type: msg.role,
					message: {
						role: msg.role,
						content,
					},
					timestamp: msg.timestamp.toISOString(),
				}),
			);

			previousUuid = uuid;
		}

		writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');

		return {
			sessionId,
			resumeCommand: getResumeCommand('Claude Code', sessionId),
		};
	},
};
