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

  // ── Incremental upgrades for existing databases ──────────────────────────
  // 1. Add stock_maximo to insumos if missing
  const insumoCols = database.exec("PRAGMA table_info(insumos)");
  if (insumoCols.length > 0) {
    const colNames = insumoCols[0].values.map(row => row[1]);
    if (!colNames.includes('stock_maximo')) {
      database.run("ALTER TABLE insumos ADD COLUMN stock_maximo REAL DEFAULT 1000 CHECK(stock_maximo > 0)");
      // Set sensible defaults for existing rows
      database.run(`UPDATE insumos SET stock_maximo = CASE
        WHEN stock_actual > 0 THEN stock_actual * 2
        WHEN stock_minimo > 0 THEN stock_minimo * 5
        ELSE 1000
      END WHERE stock_maximo IS NULL OR stock_maximo = 0`);
      console.log('  ↳ Columna stock_maximo agregada a insumos');
    }
  }

  // 2. Create movimientos_insumos table if it doesn't exist (handled by CREATE TABLE IF NOT EXISTS in the migration, but ensure index)
  database.run("CREATE INDEX IF NOT EXISTS idx_movimientos_insumos_insumo ON movimientos_insumos(id_insumo)");

  saveDb();
  console.log('✅ Migraciones ejecutadas');
}
