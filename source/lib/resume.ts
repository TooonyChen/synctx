export function getResumeCommand(agentName: string, sessionId: string): string {
	switch (agentName) {
		case 'Claude Code': {
			return `claude --resume ${sessionId}`;
		}

		case 'Codex': {
			return `codex resume ${sessionId}`;
		}

		case 'OpenCode': {
			return 'opencode';
		}

		default: {
			return '';
		}
	}
}
