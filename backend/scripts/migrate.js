const MigrationManager = require('../utils/migrationManager');

async function runMigrations() {
  try {
    const manager = new MigrationManager();
    await manager.runMigrations();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();