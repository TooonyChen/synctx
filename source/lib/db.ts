import {Database} from 'bun:sqlite';
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const DATA_DIR = join(homedir(), '.synctx');
const DB_PATH = join(DATA_DIR, 'synctx.db');

let _db: Database | null = null;

export function getDb(): Database {
	if (_db) return _db;

	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, {recursive: true});
	}

	_db = new Database(DB_PATH);
	migrate(_db);
	return _db;
}

export function isFirstRun(): boolean {
	return !existsSync(DB_PATH);
}

function migrate(db: Database) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      binary TEXT NOT NULL,
      version TEXT,
      sessions_dir TEXT,
      detected_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      session_id TEXT NOT NULL,
      project TEXT,
      message_count INTEGER DEFAULT 0,
      last_active INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(agent_name, session_id)
    );
  `);
}
