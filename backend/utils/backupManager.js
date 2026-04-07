// Advanced backup and recovery system
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const zlib = require('zlib');
const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

class BackupManager {
  constructor(db, config = {}) {
    this.db = db;
    this.dbPath = config.dbPath || null;
    this.backupDir = config.backupDir || path.join(process.cwd(), 'backups');
    this.retentionDays = config.retentionDays || 30;
    this.maxBackups = config.maxBackups || 10;
    this.encryptionKey = config.encryptionKey;
    this.schedule = config.schedule || '0 2 * * *'; // Daily at 2 AM
    this.isRunning = false;
  }

  // Initialize backup system
  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`Backup directory initialized: ${this.backupDir}`);
    } catch (error) {
      console.error('Failed to initialize backup directory:', error);
      throw error;
    }
  }

  // Create full database backup
  async createBackup(options = {}) {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // Create backup using SQLite backup API
      await this.createSQLiteBackup(backupPath);

      // Compress the backup
      const compressedPath = await this.compressBackup(backupPath, options);

      // Encrypt if key is provided
      let finalPath = compressedPath;
      if (this.encryptionKey) {
        finalPath = await this.encryptBackup(compressedPath);
        // Remove uncompressed file
        await fs.unlink(compressedPath);
      }

      // Create metadata file
      await this.createBackupMetadata(finalPath, options);

      // Clean up old backups
      await this.cleanupOldBackups();

      console.log(`Backup created successfully: ${finalPath}`);
      return {
        path: finalPath,
        size: await this.getFileSize(finalPath),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Backup creation failed:', error);
      // Clean up failed backup files
      try {
        if (await this.fileExists(backupPath)) {
          await fs.unlink(backupPath);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup failed backup:', cleanupError);
      }
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Create SQLite backup
  async createSQLiteBackup(backupPath) {
    return new Promise((resolve, reject) => {
      // Use SQLite backup API
      const backup = this.db.backup(backupPath);

      backup.step(-1, (err) => {
        if (err) {
          reject(err);
        } else {
          backup.finish((finishErr) => {
            if (finishErr) {
              reject(finishErr);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  // Compress backup file
  async compressBackup(backupPath) {
    const compressedPath = `${backupPath}.gz`;

    try {
      const fileContents = await fs.readFile(backupPath);
      const compressedData = await gzipAsync(fileContents);
      await fs.writeFile(compressedPath, compressedData);
      await fs.unlink(backupPath);
      return compressedPath;
    } catch (error) {
      console.error('Compression failed:', error);
      return backupPath;
    }
  }

  // Encrypt backup file
  async encryptBackup(filePath) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const encryptedPath = `${filePath}.enc`;
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();

    try {
      const fileContents = await fs.readFile(filePath);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const encryptedData = Buffer.concat([cipher.update(fileContents), cipher.final()]);
      await fs.writeFile(encryptedPath, Buffer.concat([iv, encryptedData]));
      await fs.unlink(filePath);
      return encryptedPath;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Backup encryption failed');
    }
  }

  // Decrypt backup file
  async decryptBackup(encryptedPath, outputPath) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    try {
      const encryptedData = await fs.readFile(encryptedPath);
      const iv = encryptedData.slice(0, 16);
      const ciphertext = encryptedData.slice(16);
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      await fs.writeFile(outputPath, decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Backup decryption failed');
    }
  }

  // Create backup metadata
  async createBackupMetadata(backupPath, options) {
    const metadata = {
      createdAt: new Date().toISOString(),
      version: '1.0',
      databaseVersion: await this.getDatabaseVersion(),
      compressed: path.extname(backupPath) === '.gz',
      encrypted: path.extname(backupPath) === '.enc',
      size: await this.getFileSize(backupPath),
      checksum: await this.calculateChecksum(backupPath),
      options: options
    };

    const metadataPath = `${backupPath}.meta.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // Get database version/info
  async getDatabaseVersion() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT sqlite_version() as version', (err, row) => {
        if (err) reject(err);
        else resolve(row.version);
      });
    });
  }

  // Calculate file checksum
  async calculateChecksum(filePath) {
    try {
      const data = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      console.error('Checksum calculation failed:', error);
      return null;
    }
  }

  // Get file size
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // Check if file exists
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Restore from backup
  async restoreBackup(backupPath, options = {}) {
    const { verifyOnly = false, targetDb = null } = options;

    try {
      const resolvedBackupPath = path.resolve(backupPath);
      const resolvedBackupDir = path.resolve(this.backupDir);
      if (!resolvedBackupPath.startsWith(resolvedBackupDir)) {
        throw new Error('Invalid backup path');
      }

      let actualBackupPath = resolvedBackupPath;

      // Handle encrypted backups
      if (path.extname(actualBackupPath) === '.enc') {
        if (!this.encryptionKey) {
          throw new Error('Encryption key required for encrypted backup');
        }
        const decryptedPath = actualBackupPath.replace(/\.enc$/, '');
        await this.decryptBackup(actualBackupPath, decryptedPath);
        actualBackupPath = decryptedPath;
      }

      // Handle compressed backups
      if (path.extname(actualBackupPath) === '.gz') {
        const decompressedPath = actualBackupPath.replace(/\.gz$/, '');
        const compressedData = await fs.readFile(actualBackupPath);
        const decompressedData = await gunzipAsync(compressedData);
        await fs.writeFile(decompressedPath, decompressedData);
        actualBackupPath = decompressedPath;
      }

      const isValid = await this.verifyBackup(actualBackupPath);
      if (!isValid) {
        throw new Error('Backup verification failed');
      }

      if (verifyOnly) {
        console.log('Backup verification successful');
        if (actualBackupPath !== resolvedBackupPath) {
          await fs.unlink(actualBackupPath);
        }
        return { verified: true };
      }

      const targetDatabasePath = targetDb || this.dbPath;
      if (!targetDatabasePath) {
        throw new Error('Target database path not configured');
      }

      await this.restoreFromFile(actualBackupPath, targetDatabasePath);

      if (actualBackupPath !== resolvedBackupPath) {
        await fs.unlink(actualBackupPath);
      }

      console.log('Database restored successfully');
      return { restored: true };

    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  // Verify backup integrity
  async verifyBackup(backupPath) {
    try {
      // Check if file exists and is readable
      await fs.access(backupPath, fs.constants.R_OK);

      // Try to open as SQLite database
      const sqlite3 = require('sqlite3').verbose();
      const testDb = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) throw err;
      });

      return new Promise((resolve) => {
        testDb.get('SELECT COUNT(*) as count FROM sqlite_master', (err, row) => {
          testDb.close();
          if (err) {
            resolve(false);
          } else {
            resolve(row.count > 0);
          }
        });
      });

    } catch (error) {
      console.error('Backup verification failed:', error);
      return false;
    }
  }

  // Restore database from file
  async restoreFromFile(backupPath, dbPath) {
    const resolvedDbPath = path.resolve(dbPath);
    if (!resolvedDbPath.startsWith(path.resolve(this.dbPath || path.dirname(resolvedDbPath)))) {
      throw new Error('Invalid database restore path');
    }

    await fs.copyFile(backupPath, resolvedDbPath);
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.startsWith('backup_') && (file.endsWith('.db') || file.endsWith('.db.gz') || file.endsWith('.db.gz.enc'))) {
          const filePath = path.join(this.backupDir, file);
          const metadataPath = `${filePath}.meta.json`;

          let metadata = null;
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (error) {
            // Metadata file might not exist for older backups
          }

          const stats = await fs.stat(filePath);
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            metadata: metadata
          });
        }
      }

      // Sort by creation time (newest first)
      backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  // Clean up old backups based on retention policy
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000));

      const toDelete = backups.filter(backup => {
        const backupDate = new Date(backup.createdAt);
        return backupDate < cutoffDate || backups.indexOf(backup) >= this.maxBackups;
      });

      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path);
          // Also delete metadata file if it exists
          const metadataPath = `${backup.path}.meta.json`;
          if (await this.fileExists(metadataPath)) {
            await fs.unlink(metadataPath);
          }
          console.log(`Deleted old backup: ${backup.filename}`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.filename}:`, error);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // Schedule automatic backups
  startScheduledBackups() {
    const cron = require('node-cron');

    if (cron.validate(this.schedule)) {
      cron.schedule(this.schedule, async () => {
        try {
          console.log('Starting scheduled backup...');
          await this.createBackup({ scheduled: true });
          console.log('Scheduled backup completed');
        } catch (error) {
          console.error('Scheduled backup failed:', error);
        }
      });

      console.log(`Scheduled backups enabled: ${this.schedule}`);
    } else {
      console.error('Invalid cron schedule:', this.schedule);
    }
  }

  // Export data to JSON format
  async exportToJSON(outputPath) {
    const tables = [
      'users', 'exams', 'questions', 'exam_sessions', 'results',
      'violation_logs', 'notifications', 'system_alerts'
    ];

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      tables: {}
    };

    for (const table of tables) {
      try {
        const rows = await new Promise((resolve, reject) => {
          this.db.all(`SELECT * FROM ${table}`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        exportData.tables[table] = rows;
      } catch (error) {
        console.error(`Failed to export table ${table}:`, error);
      }
    }

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`Data exported to: ${outputPath}`);
  }

  // Import data from JSON format
  async importFromJSON(inputPath) {
    try {
      const importData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

      for (const [table, rows] of Object.entries(importData.tables)) {
        if (rows.length > 0) {
          // Clear existing data
          await new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM ${table}`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Insert new data
          for (const row of rows) {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => '?').join(',');
            const values = columns.map(col => row[col]);

            await new Promise((resolve, reject) => {
              this.db.run(
                `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
                values,
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        }
      }

      console.log(`Data imported from: ${inputPath}`);
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }
}

module.exports = BackupManager;