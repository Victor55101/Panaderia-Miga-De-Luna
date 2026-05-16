import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDbDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || join(defaultDbDir, 'migadeluna.db');
const DB_DIR = dirname(DB_PATH);

export let db = null;

export async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(DB_PATH, buffer);
}

export async function runMigrations() {
  const database = await getDb();
  const migrationPath = join(__dirname, '..', 'migrations', '001_initial.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  database.run(sql);
  saveDb();
  console.log('✅ Migraciones ejecutadas');
}
