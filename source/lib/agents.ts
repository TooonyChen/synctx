import {execSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {getDb} from './db.js';

export type Agent = {
	name: string;
	binary: string;
	version: string;
	sessionsDir: string;
};

type AgentDef = {
	name: string;
	binary: string;
	versionFlag: string;
	sessionsDir: string;
};

const KNOWN_AGENTS: AgentDef[] = [
	{
		name: 'Claude Code',
		binary: 'claude',
		versionFlag: '--version',
		sessionsDir: join(homedir(), '.claude', 'projects'),
	},
	{
		name: 'Codex',
		binary: 'codex',
		versionFlag: '--version',
		sessionsDir: join(homedir(), '.codex'),
	},
	{
		name: 'Gemini CLI',
		binary: 'gemini',
		versionFlag: '--version',
		sessionsDir: join(homedir(), '.gemini'),
	},
	{
		name: 'OpenCode',
		binary: 'opencode',
		versionFlag: '--version',
		sessionsDir: join(homedir(), '.opencode'),
	},
	{
		name: 'Aider',
		binary: 'aider',
		versionFlag: '--version',
		sessionsDir: join(homedir(), '.aider'),
	},
];

function tryGetVersion(binary: string, flag: string): string | null {
	try {
		const out = execSync(`${binary} ${flag} 2>/dev/null`, {
			timeout: 3000,
			encoding: 'utf8',
		});
		return out.trim().split('\n')[0] ?? null;
	} catch {
		return null;
	}
}

export function detectAgents(): Agent[] {
	const detected: Agent[] = [];

	for (const def of KNOWN_AGENTS) {
		const version = tryGetVersion(def.binary, def.versionFlag);
		if (!version) continue;

		detected.push({
			name: def.name,
			binary: def.binary,
			version,
			sessionsDir: def.sessionsDir,
		});
	}

	return detected;
}

export function saveDetectedAgents(agents: Agent[]) {
	const db = getDb();
	const upsert = db.prepare(`
    INSERT INTO agents (name, binary, version, sessions_dir, detected_at)
    VALUES (:name, :binary, :version, :sessionsDir, :now)
    ON CONFLICT(name) DO UPDATE SET
      version = excluded.version,
      sessions_dir = excluded.sessions_dir,
      detected_at = excluded.detected_at
  `);

	for (const agent of agents) {
		upsert.run({
			name: agent.name,
			binary: agent.binary,
			version: agent.version,
			sessionsDir: existsSync(agent.sessionsDir) ? agent.sessionsDir : null,
			now: Date.now(),
		});
	}
}

export function getStoredAgents(): Agent[] {
	const db = getDb();
	const rows = db
		.prepare('SELECT name, binary, version, sessions_dir FROM agents')
		.all() as Array<{
		name: string;
		binary: string;
		version: string;
		sessions_dir: string;
	}>;

	return rows.map(r => ({
		name: r.name,
		binary: r.binary,
		version: r.version,
		sessionsDir: r.sessions_dir,
	}));
}
