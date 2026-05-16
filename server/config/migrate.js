import { runMigrations } from './database.js';

console.log('🚀 Iniciando migraciones...');
runMigrations()
  .then(() => {
    console.log('✅ Proceso de migración finalizado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error en migraciones:', err);
    process.exit(1);
  });
