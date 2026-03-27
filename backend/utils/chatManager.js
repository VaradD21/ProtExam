// Real-time chat system for exam support
class ChatManager {
  constructor(io) {
    this.io = io;
    this.activeChats = new Map(); // sessionId -> chat history
    this.supportQueue = new Set(); // students waiting for support
    this.organizerSockets = new Set(); // connected organizer sockets

    this.initializeSocketHandlers();
  }

  initializeSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Chat client connected: ${socket.id}`);

      // Student joins exam chat
      socket.on('join_exam_chat', (data) => {
        const { sessionId, studentId, examId } = data;
        socket.join(`exam_chat_${examId}`);
        socket.join(`student_chat_${sessionId}`);

        if (!this.activeChats.has(sessionId)) {
          this.activeChats.set(sessionId, {
            studentId,
            examId,
            messages: [],
            status: 'active',
            createdAt: new Date()
          });
        }

        socket.emit('chat_history', this.activeChats.get(sessionId).messages);
      });

      // Organizer joins support chat
      socket.on('join_support_chat', (data) => {
        const { organizerId } = data;
        this.organizerSockets.add(socket.id);
        socket.join('organizer_support');

        // Send current support queue
        socket.emit('support_queue', Array.from(this.supportQueue));
      });

      // Student sends message
      socket.on('student_message', (data) => {
        const { sessionId, message, timestamp } = data;
        const chat = this.activeChats.get(sessionId);

        if (chat) {
          const chatMessage = {
            id: Date.now(),
            from: 'student',
            message,
            timestamp: timestamp || new Date(),
            sessionId
          };

          chat.messages.push(chatMessage);

          // Send to organizers
          this.io.to('organizer_support').emit('student_message', chatMessage);

          // Confirm receipt to student
          socket.emit('message_sent', chatMessage.id);
        }
      });

      // Organizer sends message
      socket.on('organizer_message', (data) => {
        const { sessionId, message, timestamp } = data;
        const chat = this.activeChats.get(sessionId);

        if (chat) {
          const chatMessage = {
            id: Date.now(),
            from: 'organizer',
            message,
            timestamp: timestamp || new Date(),
            sessionId
          };

          chat.messages.push(chatMessage);

          // Send to student
          this.io.to(`student_chat_${sessionId}`).emit('organizer_message', chatMessage);
        }
      });

      // Student requests help
      socket.on('request_help', (data) => {
        const { sessionId, urgency = 'normal' } = data;
        this.supportQueue.add(sessionId);

        const helpRequest = {
          sessionId,
          urgency,
          timestamp: new Date(),
          status: 'pending'
        };

        // Notify all organizers
        this.io.to('organizer_support').emit('help_request', helpRequest);

        // Confirm to student
        socket.emit('help_requested', helpRequest);
      });

      // Organizer accepts help request
      socket.on('accept_help_request', (data) => {
        const { sessionId } = data;

        if (this.supportQueue.has(sessionId)) {
          this.supportQueue.delete(sessionId);

          // Notify student that help is coming
          this.io.to(`student_chat_${sessionId}`).emit('help_accepted', {
            sessionId,
            timestamp: new Date()
          });

          // Update queue for all organizers
          this.io.to('organizer_support').emit('support_queue', Array.from(this.supportQueue));
        }
      });

      // Mark chat as resolved
      socket.on('resolve_chat', (data) => {
        const { sessionId } = data;
        const chat = this.activeChats.get(sessionId);

        if (chat) {
          chat.status = 'resolved';
          chat.resolvedAt = new Date();

          // Notify both parties
          this.io.to(`student_chat_${sessionId}`).emit('chat_resolved', {
            sessionId,
            timestamp: new Date()
          });

          this.io.to('organizer_support').emit('chat_resolved', { sessionId });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.organizerSockets.delete(socket.id);
      });
    });
  }

  // Get chat statistics
  getChatStats() {
    const stats = {
      totalChats: this.activeChats.size,
      activeChats: 0,
      resolvedChats: 0,
      pendingHelpRequests: this.supportQueue.size,
      connectedOrganizers: this.organizerSockets.size
    };

    for (const chat of this.activeChats.values()) {
      if (chat.status === 'active') stats.activeChats++;
      if (chat.status === 'resolved') stats.resolvedChats++;
    }

    return stats;
  }

  // Get chat history for a session
  getChatHistory(sessionId) {
    const chat = this.activeChats.get(sessionId);
    return chat ? chat.messages : [];
  }

  // Clean up old resolved chats (older than 24 hours)
  cleanupOldChats() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [sessionId, chat] of this.activeChats.entries()) {
      if (chat.status === 'resolved' && chat.resolvedAt < cutoffTime) {
        this.activeChats.delete(sessionId);
      }
    }
  }
}

module.exports = ChatManager;