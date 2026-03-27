// Advanced notification and alert system
class NotificationManager {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.templates = new Map();
    this.activeAlerts = new Map();
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  // Initialize notification templates
  initializeTemplates() {
    this.templates.set('exam_started', {
      title: 'Exam Started',
      message: 'Your exam "{examName}" has started. You have {timeLimit} minutes to complete it.',
      type: 'info',
      priority: 'high'
    });

    this.templates.set('exam_ending_soon', {
      title: 'Exam Ending Soon',
      message: 'Your exam "{examName}" will end in {minutesLeft} minutes.',
      type: 'warning',
      priority: 'high'
    });

    this.templates.set('exam_submitted', {
      title: 'Exam Submitted',
      message: 'Your exam "{examName}" has been submitted successfully.',
      type: 'success',
      priority: 'medium'
    });

    this.templates.set('violation_detected', {
      title: 'Violation Detected',
      message: 'A violation has been detected during your exam. This has been recorded.',
      type: 'warning',
      priority: 'high'
    });

    this.templates.set('exam_scheduled', {
      title: 'Exam Scheduled',
      message: 'You have an exam "{examName}" scheduled for {scheduledTime}.',
      type: 'info',
      priority: 'medium'
    });

    this.templates.set('certificate_ready', {
      title: 'Certificate Ready',
      message: 'Your certificate for "{examName}" is now available for download.',
      type: 'success',
      priority: 'medium'
    });

    this.templates.set('system_alert', {
      title: 'System Alert',
      message: '{message}',
      type: 'warning',
      priority: 'high'
    });
  }

  // Send notification to user
  async sendNotification(userId, templateKey, data = {}, options = {}) {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new Error(`Notification template '${templateKey}' not found`);
    }

    const notification = {
      id: this.generateId(),
      userId,
      title: this.interpolate(template.title, data),
      message: this.interpolate(template.message, data),
      type: template.type,
      priority: template.priority,
      read: false,
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresAt,
      metadata: options.metadata || {}
    };

    // Store in database
    await this.storeNotification(notification);

    // Send real-time notification if user is online
    this.sendRealTimeNotification(userId, notification);

    // Handle email notifications if enabled
    if (options.sendEmail) {
      await this.sendEmailNotification(notification);
    }

    return notification;
  }

  // Send bulk notifications
  async sendBulkNotifications(userIds, templateKey, data = {}, options = {}) {
    const notifications = [];

    for (const userId of userIds) {
      try {
        const notification = await this.sendNotification(userId, templateKey, data, options);
        notifications.push(notification);
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    }

    return notifications;
  }

  // Store notification in database
  async storeNotification(notification) {
    const sql = `
      INSERT INTO notifications
      (id, user_id, title, message, type, priority, read, created_at, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      notification.id,
      notification.userId,
      notification.title,
      notification.message,
      notification.type,
      notification.priority,
      notification.read ? 1 : 0,
      notification.createdAt,
      notification.expiresAt,
      JSON.stringify(notification.metadata)
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Send real-time notification via Socket.io
  sendRealTimeNotification(userId, notification) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit('notification', notification);
    }
  }

  // Send email notification (placeholder for email service integration)
  async sendEmailNotification(notification) {
    // This would integrate with an email service like SendGrid, Mailgun, etc.
    console.log(`Email notification would be sent: ${notification.title} to user ${notification.userId}`);
    // Implementation would depend on chosen email service
  }

  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    const { limit = 50, offset = 0, unreadOnly = false, type = null } = options;

    let sql = `
      SELECT * FROM notifications
      WHERE user_id = ?
    `;
    const params = [userId];

    if (unreadOnly) {
      sql += ' AND read = 0';
    }

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          metadata: JSON.parse(row.metadata || '{}')
        })));
      });
    });
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const sql = `
      UPDATE notifications
      SET read = 1, read_at = ?
      WHERE id = ? AND user_id = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [new Date().toISOString(), notificationId, userId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId) {
    const sql = `
      UPDATE notifications
      SET read = 1, read_at = ?
      WHERE user_id = ? AND read = 0
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [new Date().toISOString(), userId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    const sql = 'DELETE FROM notifications WHERE id = ? AND user_id = ?';

    return new Promise((resolve, reject) => {
      this.db.run(sql, [notificationId, userId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // Create alert for system-wide issues
  async createAlert(alertData) {
    const alert = {
      id: this.generateId(),
      title: alertData.title,
      message: alertData.message,
      type: alertData.type || 'warning',
      severity: alertData.severity || 'medium',
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: alertData.expiresAt,
      affectedUsers: alertData.affectedUsers || [],
      metadata: alertData.metadata || {}
    };

    this.activeAlerts.set(alert.id, alert);

    // Store in database
    await this.storeAlert(alert);

    // Send to affected users
    if (alert.affectedUsers.length > 0) {
      await this.sendBulkNotifications(
        alert.affectedUsers,
        'system_alert',
        { message: alert.message },
        { metadata: { alertId: alert.id } }
      );
    }

    // Broadcast to all online users if critical
    if (alert.severity === 'critical') {
      this.broadcastAlert(alert);
    }

    return alert;
  }

  // Store alert in database
  async storeAlert(alert) {
    const sql = `
      INSERT INTO system_alerts
      (id, title, message, type, severity, active, created_at, expires_at, affected_users, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      alert.id,
      alert.title,
      alert.message,
      alert.type,
      alert.severity,
      alert.active ? 1 : 0,
      alert.createdAt,
      alert.expiresAt,
      JSON.stringify(alert.affectedUsers),
      JSON.stringify(alert.metadata)
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Broadcast alert to all connected users
  broadcastAlert(alert) {
    if (this.io) {
      this.io.emit('system_alert', alert);
    }
  }

  // Resolve alert
  async resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.active = false;
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.delete(alertId);

      // Update in database
      const sql = 'UPDATE system_alerts SET active = 0, resolved_at = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        this.db.run(sql, [alert.resolvedAt, alertId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  // Get active alerts
  async getActiveAlerts() {
    const sql = `
      SELECT * FROM system_alerts
      WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [new Date().toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          affectedUsers: JSON.parse(row.affected_users || '[]'),
          metadata: JSON.parse(row.metadata || '{}')
        })));
      });
    });
  }

  // Schedule notification
  async scheduleNotification(userId, templateKey, data, scheduledTime, options = {}) {
    const scheduledNotification = {
      id: this.generateId(),
      userId,
      templateKey,
      data,
      scheduledTime,
      options,
      status: 'pending'
    };

    // Store in scheduled notifications table
    const sql = `
      INSERT INTO scheduled_notifications
      (id, user_id, template_key, data, scheduled_time, options, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      scheduledNotification.id,
      userId,
      templateKey,
      JSON.stringify(data),
      scheduledTime,
      JSON.stringify(options),
      'pending'
    ];

    await new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    return scheduledNotification;
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date().toISOString();
      const sql = `
        SELECT * FROM scheduled_notifications
        WHERE status = 'pending' AND scheduled_time <= ?
        ORDER BY scheduled_time ASC
        LIMIT 10
      `;

      const notifications = await new Promise((resolve, reject) => {
        this.db.all(sql, [now], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      for (const notification of notifications) {
        try {
          await this.sendNotification(
            notification.user_id,
            notification.template_key,
            JSON.parse(notification.data),
            JSON.parse(notification.options)
          );

          // Mark as sent
          await new Promise((resolve, reject) => {
            this.db.run(
              'UPDATE scheduled_notifications SET status = ?, sent_at = ? WHERE id = ?',
              ['sent', now, notification.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        } catch (error) {
          console.error(`Failed to send scheduled notification ${notification.id}:`, error);
          // Mark as failed
          await new Promise((resolve, reject) => {
            this.db.run(
              'UPDATE scheduled_notifications SET status = ?, error = ? WHERE id = ?',
              ['failed', error.message, notification.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Start scheduler for processing notifications
  startScheduler() {
    // Process every minute
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60000);
  }

  // Generate unique ID
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Interpolate template variables
  interpolate(template, data) {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }
}

module.exports = NotificationManager;