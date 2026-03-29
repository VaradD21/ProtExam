const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.migrationTable = 'schema_migrations';
    this.dbPath = path.join(__dirname, '../data/protexam.db');

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!require('fs').existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath);
    this.db.configure('busyTimeout', 10000);
  }

  async initialize() {
    // Create migrations table if it doesn't exist
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getExecutedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT migration_name FROM ${this.migrationTable} ORDER BY id`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.migration_name));
      });
    });
  }

  async executeMigration(migrationName, sql) {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err);

        this.db.run(sql, (err) => {
          if (err) {
            this.db.run('ROLLBACK', () => reject(err));
            return;
          }

          const insertSql = `INSERT INTO ${this.migrationTable} (migration_name) VALUES (?)`;
          this.db.run(insertSql, [migrationName], (err) => {
            if (err) {
              this.db.run('ROLLBACK', () => reject(err));
              return;
            }

            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      });
    });
  }

  async runMigrations() {
    try {
      console.log('Initializing migration system...');
      await this.initialize();
      const executedMigrations = await this.getExecutedMigrations();
      console.log(`Found ${executedMigrations.length} executed migrations`);

      // Get all migration files
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure proper order

      console.log(`Found ${migrationFiles.length} migration files`);

      let executedCount = 0;

      for (const file of migrationFiles) {
        const migrationName = path.parse(file).name;

        if (!executedMigrations.includes(migrationName)) {
          console.log(`Executing migration: ${migrationName}`);
          const filePath = path.join(this.migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf8');

          await this.executeMigration(migrationName, sql);
          executedCount++;
        } else {
          console.log(`Migration ${migrationName} already executed`);
        }
      }

      console.log(`✅ Executed ${executedCount} new migrations`);
    } catch (error) {
      console.error('❌ Migration execution failed:', error.message);
      throw error;
    }
  }

      console.log(`Migrations completed. Executed ${executedCount} new migrations.`);
      return executedCount;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  async createMigration(name, sql) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${timestamp}_${name}.sql`;
    const filePath = path.join(this.migrationsDir, filename);

    await fs.writeFile(filePath, sql);
    console.log(`Migration created: ${filename}`);
    return filename;
  }
}

module.exports = MigrationManager;