import {homedir} from 'node:os';
import {join} from 'node:path';

export type PlatformPaths = {
	darwin: string; // macOS
	linux: string;
	win32: string; // Windows
};

export function resolvePath(paths: PlatformPaths): string {
	const platform = process.platform;
	if (platform in paths) {
		return paths[platform as keyof PlatformPaths];
	}

	return paths.linux; // sensible fallback
}

const home = homedir();

export const AGENT_PATHS = {
	claudeCode: {
		sessionsDir: {
			darwin: join(home, '.claude', 'projects'),
			linux: join(home, '.claude', 'projects'),
			win32: join(home, 'AppData', 'Roaming', 'Claude', 'projects'),
		},
	},
	codex: {
		sessionsDir: {
			darwin: join(home, '.codex', 'sessions'),
			linux: join(home, '.codex', 'sessions'),
			win32: join(home, 'AppData', 'Roaming', 'Codex', 'sessions'),
		},
	},
	gemini: {
		tmpDir: {
			darwin: join(home, '.gemini', 'tmp'),
			linux: join(home, '.gemini', 'tmp'),
			win32: join(home, 'AppData', 'Roaming', 'Google', 'gemini', 'tmp'),
		},
	},
	opencode: {
		dbPath: {
			darwin: join(home, '.local', 'share', 'opencode', 'opencode.db'),
			linux: join(home, '.local', 'share', 'opencode', 'opencode.db'),
			win32: join(home, 'AppData', 'Local', 'opencode', 'opencode.db'),
		},
	},
} as const;
