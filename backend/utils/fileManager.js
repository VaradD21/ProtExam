// File upload and management system
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileManager {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
      code: ['text/plain', 'application/json', 'application/javascript', 'text/html', 'text/css']
    };
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.initializeDirectories();
  }

  async initializeDirectories() {
    const directories = [
      this.uploadDir,
      path.join(this.uploadDir, 'images'),
      path.join(this.uploadDir, 'documents'),
      path.join(this.uploadDir, 'videos'),
      path.join(this.uploadDir, 'audio'),
      path.join(this.uploadDir, 'code'),
      path.join(this.uploadDir, 'temp')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.error(`Failed to create directory ${dir}:`, error);
        }
      }
    }
  }

  // Generate unique filename
  generateFilename(originalName, type = 'misc') {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${type}_${timestamp}_${random}${ext}`;
  }

  // Validate file
  validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check file type
    const isAllowed = Object.values(this.allowedTypes).some(types => types.includes(file.mimetype));
    if (!isAllowed) {
      errors.push('File type not allowed');
    }

    return errors;
  }

  // Get file type category
  getFileCategory(mimetype) {
    for (const [category, types] of Object.entries(this.allowedTypes)) {
      if (types.includes(mimetype)) {
        return category;
      }
    }
    return 'misc';
  }

  // Save uploaded file
  async saveFile(file, context = {}) {
    const validationErrors = this.validateFile(file);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    const category = this.getFileCategory(file.mimetype);
    const filename = this.generateFilename(file.originalname, category);
    const filePath = path.join(this.uploadDir, category, filename);

    // Move file from temp to permanent location
    await fs.rename(file.path, filePath);

    const fileInfo = {
      id: crypto.randomUUID(),
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      category,
      path: filePath,
      url: `/uploads/${category}/${filename}`,
      uploadedBy: context.userId,
      uploadedAt: new Date(),
      context: context, // examId, questionId, etc.
      checksum: await this.calculateChecksum(filePath)
    };

    return fileInfo;
  }

  // Calculate file checksum
  async calculateChecksum(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  // Get file info
  async getFileInfo(fileId) {
    // In a real implementation, this would query a database
    // For now, return mock data
    return {
      id: fileId,
      filename: 'example.pdf',
      url: '/uploads/documents/example.pdf',
      uploadedAt: new Date()
    };
  }

  // Delete file
  async deleteFile(fileId) {
    // In a real implementation, this would:
    // 1. Get file info from database
    // 2. Delete file from filesystem
    // 3. Remove database record
    console.log(`Deleting file: ${fileId}`);
    return true;
  }

  // Clean up old temp files
  async cleanupTempFiles() {
    const tempDir = path.join(this.uploadDir, 'temp');
    const files = await fs.readdir(tempDir);
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        console.error(`Failed to cleanup temp file ${file}:`, error);
      }
    }
  }

  // Get storage statistics
  async getStorageStats() {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {}
    };

    for (const category of Object.keys(this.allowedTypes)) {
      const categoryDir = path.join(this.uploadDir, category);
      try {
        const files = await fs.readdir(categoryDir);
        stats.byCategory[category] = {
          count: files.length,
          size: 0
        };

        for (const file of files) {
          const filePath = path.join(categoryDir, file);
          const fileStats = await fs.stat(filePath);
          stats.byCategory[category].size += fileStats.size;
          stats.totalSize += fileStats.size;
        }

        stats.totalFiles += files.length;
      } catch (error) {
        stats.byCategory[category] = { count: 0, size: 0 };
      }
    }

    return stats;
  }

  // Create file serving middleware
  createFileServeMiddleware() {
    return async (req, res, next) => {
      const filePath = path.join(this.uploadDir, req.path.replace('/uploads/', ''));

      try {
        const stats = await fs.stat(filePath);
        res.setHeader('Content-Type', this.getMimeType(filePath));
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year

        const stream = require('fs').createReadStream(filePath);
        stream.pipe(res);
      } catch (error) {
        res.status(404).json({ error: 'File not found' });
      }
    };
  }

  // Get MIME type from file extension
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.css': 'text/css'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = FileManager;