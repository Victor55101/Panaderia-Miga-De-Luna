import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function seedDemoData({ force = false } = {}) {
  const db = await getDb();
  const userCount = db.exec('SELECT COUNT(*) FROM usuarios')[0]?.values?.[0]?.[0] ?? 0;
  const productCount = db.exec('SELECT COUNT(*) FROM productos')[0]?.values?.[0]?.[0] ?? 0;

  if (!force && userCount > 0 && productCount > 0) {
    console.log('ℹ️ Semillas omitidas: la base ya contiene usuarios y productos.');
    return { skipped: true, userCount, productCount };
  }

  const sqlPath = join(__dirname, 'demo_data.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  db.run(sql);
  saveDb();

  const totals = {
    sucursales: db.exec('SELECT COUNT(*) FROM sucursales')[0]?.values?.[0]?.[0] ?? 0,
    usuarios: db.exec('SELECT COUNT(*) FROM usuarios')[0]?.values?.[0]?.[0] ?? 0,
    productos: db.exec('SELECT COUNT(*) FROM productos')[0]?.values?.[0]?.[0] ?? 0,
    ventas: db.exec('SELECT COUNT(*) FROM ventas')[0]?.values?.[0]?.[0] ?? 0,
    insumos: db.exec('SELECT COUNT(*) FROM insumos')[0]?.values?.[0]?.[0] ?? 0,
    recetas: db.exec('SELECT COUNT(*) FROM recetas')[0]?.values?.[0]?.[0] ?? 0
  };

  console.log(`✅ Semillas demo ejecutadas. Usuarios: ${totals.usuarios}, Productos: ${totals.productos}, Ventas: ${totals.ventas}`);
  return { skipped: false, totals };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  seedDemoData({ force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error al ejecutar semillas:', err);
      process.exit(1);
    });
}
