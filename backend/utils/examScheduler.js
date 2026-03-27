// Exam scheduling and calendar management
class ExamScheduler {
  constructor() {
    this.scheduledExams = new Map(); // examId -> schedule info
    this.reminders = new Map(); // reminderId -> reminder info
    this.timeZone = 'UTC';
  }

  // Schedule an exam
  scheduleExam(examId, scheduleData) {
    const {
      startTime,
      endTime,
      timeZone = 'UTC',
      reminders = [],
      recurrence = null,
      maxStudents = null,
      autoStart = false,
      autoEnd = true
    } = scheduleData;

    const schedule = {
      examId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timeZone,
      reminders,
      recurrence,
      maxStudents,
      autoStart,
      autoEnd,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.scheduledExams.set(examId, schedule);

    // Schedule reminders
    this.scheduleReminders(examId, reminders);

    // Schedule auto-start/end if enabled
    if (autoStart) {
      this.scheduleAutoStart(examId, schedule.startTime);
    }
    if (autoEnd) {
      this.scheduleAutoEnd(examId, schedule.endTime);
    }

    return schedule;
  }

  // Schedule reminders
  scheduleReminders(examId, reminders) {
    reminders.forEach((reminder, index) => {
      const reminderId = `${examId}_reminder_${index}`;
      const reminderTime = new Date(reminder.time);

      const reminderInfo = {
        id: reminderId,
        examId,
        type: reminder.type, // 'email', 'notification', 'sms'
        time: reminderTime,
        message: reminder.message,
        recipients: reminder.recipients, // 'all', 'registered', 'organizer'
        status: 'scheduled'
      };

      this.reminders.set(reminderId, reminderInfo);

      // Schedule the reminder (in a real implementation, this would use a job scheduler)
      const timeUntilReminder = reminderTime.getTime() - Date.now();
      if (timeUntilReminder > 0) {
        setTimeout(() => {
          this.sendReminder(reminderInfo);
        }, timeUntilReminder);
      }
    });
  }

  // Schedule auto-start
  scheduleAutoStart(examId, startTime) {
    const timeUntilStart = startTime.getTime() - Date.now();
    if (timeUntilStart > 0) {
      setTimeout(() => {
        this.autoStartExam(examId);
      }, timeUntilStart);
    }
  }

  // Schedule auto-end
  scheduleAutoEnd(examId, endTime) {
    const timeUntilEnd = endTime.getTime() - Date.now();
    if (timeUntilEnd > 0) {
      setTimeout(() => {
        this.autoEndExam(examId);
      }, timeUntilEnd);
    }
  }

  // Send reminder (placeholder - would integrate with email/SMS service)
  sendReminder(reminderInfo) {
    console.log(`Sending ${reminderInfo.type} reminder for exam ${reminderInfo.examId}: ${reminderInfo.message}`);

    // In a real implementation, this would:
    // - Send email via SendGrid/Mailgun
    // - Send SMS via Twilio
    // - Send push notifications
    // - Update reminder status

    reminderInfo.status = 'sent';
    reminderInfo.sentAt = new Date();
  }

  // Auto-start exam
  autoStartExam(examId) {
    const schedule = this.scheduledExams.get(examId);
    if (schedule) {
      schedule.status = 'active';
      console.log(`Auto-started exam ${examId}`);

      // Emit socket event to notify students/organizers
      // This would be called from the main server file
    }
  }

  // Auto-end exam
  autoEndExam(examId) {
    const schedule = this.scheduledExams.get(examId);
    if (schedule) {
      schedule.status = 'completed';
      console.log(`Auto-ended exam ${examId}`);

      // Auto-submit all active sessions
      // This would trigger the submission logic
    }
  }

  // Get exam schedule
  getExamSchedule(examId) {
    return this.scheduledExams.get(examId);
  }

  // Get all scheduled exams
  getAllScheduledExams() {
    return Array.from(this.scheduledExams.values());
  }

  // Get exams scheduled for a specific time range
  getExamsInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return Array.from(this.scheduledExams.values()).filter(schedule => {
      return schedule.startTime >= start && schedule.startTime <= end;
    });
  }

  // Update exam schedule
  updateExamSchedule(examId, updates) {
    const schedule = this.scheduledExams.get(examId);
    if (schedule) {
      Object.assign(schedule, updates, { updatedAt: new Date() });
      return schedule;
    }
    return null;
  }

  // Cancel exam schedule
  cancelExamSchedule(examId) {
    const schedule = this.scheduledExams.get(examId);
    if (schedule) {
      schedule.status = 'cancelled';
      schedule.cancelledAt = new Date();

      // Cancel all associated reminders
      this.cancelReminders(examId);
    }
    return schedule;
  }

  // Cancel reminders for an exam
  cancelReminders(examId) {
    for (const [reminderId, reminder] of this.reminders.entries()) {
      if (reminder.examId === examId) {
        reminder.status = 'cancelled';
      }
    }
  }

  // Get upcoming exams
  getUpcomingExams(hours = 24) {
    const now = new Date();
    const future = new Date(now.getTime() + (hours * 60 * 60 * 1000));

    return Array.from(this.scheduledExams.values())
      .filter(schedule => schedule.startTime > now && schedule.startTime <= future)
      .sort((a, b) => a.startTime - b.startTime);
  }

  // Check for conflicts
  checkScheduleConflicts(examId, startTime, endTime) {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    const conflicts = Array.from(this.scheduledExams.values())
      .filter(schedule => schedule.examId !== examId)
      .filter(schedule => {
        // Check for time overlap
        return (schedule.startTime < newEnd && schedule.endTime > newStart);
      });

    return conflicts;
  }

  // Get calendar data for a month
  getCalendarData(year, month) {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    const examsInMonth = Array.from(this.scheduledExams.values())
      .filter(schedule => {
        return schedule.startTime >= startOfMonth && schedule.startTime <= endOfMonth;
      })
      .map(schedule => ({
        examId: schedule.examId,
        date: schedule.startTime.toISOString().split('T')[0],
        time: schedule.startTime.toTimeString().slice(0, 5),
        title: `Exam ${schedule.examId}`,
        status: schedule.status
      }));

    return examsInMonth;
  }
}

module.exports = ExamScheduler;