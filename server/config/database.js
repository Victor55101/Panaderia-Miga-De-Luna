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

  // 3. Refactor productos tipo vs categoria constraint
  const checkTipoSql = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='productos'");
  if (checkTipoSql.length > 0 && checkTipoSql[0].values[0][0].includes("pan_blanco")) {
    console.log('  ↳ Refactorizando esquema de la tabla productos (Categoría vs Tipo)...');
    database.run("PRAGMA foreign_keys=OFF;");
    database.run("BEGIN TRANSACTION;");
    database.run(`
      CREATE TABLE IF NOT EXISTS productos_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        id_categoria INTEGER NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'Producto de línea' CHECK(tipo IN ('Producto de línea', 'Producto de temporada', 'Edición especial')),
        unidad_medida TEXT NOT NULL DEFAULT 'pieza',
        costo REAL NOT NULL DEFAULT 0 CHECK(costo >= 0),
        precio REAL NOT NULL DEFAULT 0 CHECK(precio >= 0),
        es_estrella INTEGER NOT NULL DEFAULT 0,
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (id_categoria) REFERENCES categorias(id)
      );
    `);
    
    // Mapear los tipos anteriores a 'Producto de línea'
    database.run(`
      INSERT INTO productos_new (id, nombre, id_categoria, tipo, unidad_medida, costo, precio, es_estrella, activo, created_at, updated_at)
      SELECT id, nombre, id_categoria, 'Producto de línea', unidad_medida, costo, precio, es_estrella, activo, created_at, updated_at 
      FROM productos;
    `);
    
    database.run("DROP TABLE productos;");
    database.run("ALTER TABLE productos_new RENAME TO productos;");
    database.run("COMMIT;");
    database.run("PRAGMA foreign_keys=ON;");
    console.log('  ↳ Tabla productos refactorizada.');
  }

  saveDb();
  console.log('✅ Migraciones ejecutadas');
}
