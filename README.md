# ProExam - Online Examination System with Anti-Cheating Detection

A comprehensive web-based examination platform with robust anti-cheating mechanisms, real-time monitoring, and advanced behavior tracking.

## Features

### Core Functionality
- ✅ **Dual Role System**: Organizer (Admin) and Student roles with role-based access control
- ✅ **Exam Management**: Create, edit, delete exams with comprehensive settings
- ✅ **Question Bank**: Support for MCQ and descriptive questions with randomization
- ✅ **Auto-grading**: Automatic scoring for MCQ questions
- ✅ **Manual Grading**: Support for descriptive question evaluation
- ✅ **Exam Timer**: Countdown timer with auto-submit functionality
- ✅ **Question Navigation**: Panel for question browsing and status tracking

### Anti-Cheating Mechanisms
- ✅ **Tab Switching Detection**: Detects when students switch away from exam tab
- ✅ **Fullscreen Enforcement**: Requires and monitors fullscreen mode
- ✅ **Fullscreen Exit Detection**: Logs when student exits fullscreen
- ✅ **Copy/Paste Prevention**: Disables copy, cut, paste operations
- ✅ **Right-Click Disabled**: Prevents context menu usage
- ✅ **Devtools Detection**: Detects F12, Ctrl+Shift+I, and other devtools shortcuts
- ✅ **Keyboard Shortcut Blocking**: Prevents Ctrl+A, Ctrl+S, Ctrl+P, Alt+Tab, PrintScreen
- ✅ **Mouse Leave Detection**: Logs when mouse leaves exam window
- ✅ **Inactivity Monitoring**: Tracks user inactivity periods
- ✅ **Violation Logging**: All violations are timestamped and logged to server

### Behavior Tracking
- ✅ **Answer Change Tracking**: Counts how many times answer is modified
- ✅ **Time Per Question**: Tracks time spent on each question
- ✅ **Activity Logging**: Records all student interactions
- ✅ **Violation Aggregation**: Calculates suspicion score based on violations
- ✅ **Auto-Submit**: Automatically submits exam after excessive violations (threshold: 3)

### Organizer Features
- ✅ **Dashboard**: Overview of exams, sessions, and violations
- ✅ **Exam Management**: Full CRUD operations for exams
- ✅ **Question Bank**: Create and manage MCQ and descriptive questions
- ✅ **Live Monitoring**: View real-time student status during exam
- ✅ **Results View**: Analyze student performance with detailed breakdowns
- ✅ **Violation Reports**: View all violations per exam and per student
- ✅ **Student Enrollment**: Manage which students can take which exams

### Student Features
- ✅ **Exam Interface**: Clean, distraction-free exam UI
- ✅ **Question Panel**: Navigate between questions with status indicators
- ✅ **MCQ Interface**: Radio button selection for multiple choice
- ✅ **Descriptive Interface**: Textarea for essay/descriptive answers
- ✅ **Progress Tracking**: See answered vs unanswered questions
- ✅ **Exam Results**: Detailed results page with question analysis

## Recent Improvements (v1.1)

### Security Enhancements
- 🔒 **CORS Security**: Restricted CORS to specific origins instead of allowing all
- 🛡️ **Security Headers**: Added X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- 📏 **Request Limits**: Reduced body parser limits to prevent abuse
- 🔐 **Environment Variables**: Added support for configurable JWT secrets and frontend URLs

### User Experience Improvements
- 🎨 **Enhanced Login**: Better validation, loading states, and error messages
- 🔄 **Loading Indicators**: Added spinners and loading overlays throughout the app
- 🚨 **Error Handling**: Improved error messages and user feedback
- 📱 **Responsive Design**: Better mobile and tablet support
- ♿ **Accessibility**: Added proper labels, hints, and ARIA attributes

### Performance Optimizations
- ⚡ **Dynamic API URLs**: Frontend automatically detects server location
- 🔄 **Better Error Recovery**: Network error handling and retry mechanisms
- 📊 **Loading States**: Prevents user interaction during async operations
- 🎯 **Input Validation**: Client-side validation with helpful hints

### Code Quality
- 🧹 **Error Handling**: Comprehensive try-catch blocks and user-friendly error messages
- 🔧 **Code Organization**: Better separation of concerns and modular functions
- 📝 **Documentation**: Updated README and inline code comments
- 🛠️ **Development Tools**: Added nodemon for development workflow
- ✅ **Violation Display**: See which actions were flagged during exam

## Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** for data persistence
- **Socket.io** for real-time communication
- **JWT** for authentication
- **bcryptjs** for password hashing

### Frontend
- **Vanilla JavaScript** (no frameworks - keeps it lightweight)
- **HTML5** with semantic markup
- **CSS3** with responsive design
- **WebSocket API** for real-time updates

## Project Structure

```
protexam/
├── backend/
│   ├── server.js                 # Express server with Socket.io
│   ├── package.json
│   ├── models/
│   │   └── database.js          # SQLite schema and operations
│   ├── routes/
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── exams.js             # Exam management APIs
│   │   ├── questions.js         # Question management APIs
│   │   ├── submissions.js       # Answer submission endpoints
│   │   ├── logs.js              # Activity and violation logging
│   │   └── monitoring.js        # Live monitoring data
│   ├── middleware/
│   │   └── auth.js              # JWT verification and role checks
│   └── utils/
│       └── scoring.js           # Auto-grading logic
│
├── frontend/
│   ├── login.html               # Unified login page
│   ├── css/
│   │   └── login-styles.css
│   ├── js/
│   │   ├── config.js            # API configuration and helpers
│   │   └── login.js             # Authentication logic
│   │
│   ├── student/
│   │   ├── index.html           # Main exam interface
│   │   ├── examList.html        # Available exams listing
│   │   ├── results.html         # Results and analysis page
│   │   ├── css/
│   │   │   ├── styles.css       # Exam interface styles
│   │   │   ├── exam-list-styles.css
│   │   │   └── results-styles.css
│   │   └── js/
│   │       ├── antiCheating.js  # Anti-cheating detection system
│   │       ├── examInterface.js # Exam UI logic
│   │       ├── examList.js      # Exam selection logic
│   │       └── results.js       # Results page logic
│   │
│   └── organizer/
│       ├── index.html           # Organizer dashboard
│       ├── css/
│       │   └── styles.css       # Dashboard styles
│       └── js/
│           └── main.js          # Dashboard logic
│
└── data/
    └── protexam.db              # SQLite database (auto-created)
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd protexam/backend
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   
   The server will run on `http://localhost:5001`

### Frontend Setup

The frontend is already configured and will be served by the Express server.

Access the system at:
- **Login**: http://localhost:5001/login.html
- **Student Dashboard**: http://localhost:5001/student/
- **Organizer Dashboard**: http://localhost:5001/organizer/

## Default Users (for testing)

Create these accounts using the registration system:

### Organizer Account
- **Email**: organizer@test.com
- **Password**: password123
- **Role**: Organizer

### Student Accounts
- **Email**: student1@test.com
- **Password**: password123
- **Role**: Student

## Usage Guide

### For Organizers

1. **Login** as organizer
2. **Create Exam**:
   - Click "Create New Exam"
   - Fill in exam details (title, duration, marks, passing marks)
   - Save exam

3. **Add Questions**:
   - Go to Exams tab
   - Click "Questions" button on exam
   - Add MCQ or descriptive questions
   - For MCQ, mark the correct option

4. **Monitor Students**:
   - Go to Monitoring tab
   - Select exam to monitor
   - View real-time student status and violations

5. **View Results**:
   - Go to Results tab
   - Select exam
   - View student scores and question analysis

### For Students

1. **Login** as student
2. **Select Exam**:
   - View available exams
   - Click "Start Exam"
   - Confirm fullscreen entry

3. **Take Exam**:
   - Read instructions and questions
   - Answer questions using MCQ or text
   - Use question panel to navigate
   - Monitor timer and violations

4. **Submit Exam**:
   - Review answers
   - Click "Submit Exam"
   - System auto-grades and shows results

5. **View Results**:
   - See score, percentage, pass/fail status
   - Review question-wise analysis
   - Check violations and activity logs

## Anti-Cheating Implementation Details

### Detection Methods

1. **Tab Switching**:
   - Uses `visibilitychange` event
   - Detects when tab loses/gains focus
   - Logs each violation with timestamp

2. **Fullscreen Enforcement**:
   - Requires fullscreen mode at exam start
   - Monitors `fullscreenchange` events
   - Detects exit and logs violation

3. **Copy/Paste Prevention**:
   - Prevents `copy`, `paste`, `cut` events
   - Shows warning to user
   - Logs attempt with severity

4. **Devtools Detection**:
   - Blocks F12 key
   - Detects Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J
   - Monitors execution time for devtools check

5. **Keyboard Shortcuts**:
   - Blocks Ctrl+A (select all)
   - Blocks Ctrl+S (save)
   - Blocks Ctrl+P (print)
   - Blocks Alt+Tab (switch app)
   - Blocks PrintScreen

6. **Mouse Tracking**:
   - Detects when mouse leaves window
   - Logs the violation

7. **Inactivity Detection**:
   - Tracks 1-minute inactivity
   - Logs when user is inactive

### Violation Severity Levels

- **HIGH**: Tab switching, fullscreen exit, paste attempt
- **MEDIUM**: Copy attempt, cut attempt, screenshot attempt
- **LOW**: Right-click, mouse leave, devtools potential, inactivity

### Auto-Submit Trigger

- **Threshold**: 3 violations of any kind
- **Action**: Exam is automatically submitted
- **Notification**: Student is notified before auto-submit

## Database Schema

### Users Table
```sql
- id (INTEGER, PRIMARY KEY)
- email (TEXT, UNIQUE)
- password (TEXT, hashed)
- fullName (TEXT)
- role (TEXT: 'organizer' or 'student')
- createdAt (DATETIME)
- isActive (BOOLEAN)
```

### Exams Table
```sql
- id (INTEGER, PRIMARY KEY)
- organizerId (INTEGER, FOREIGN KEY)
- title (TEXT)
- description (TEXT)
- duration (INTEGER) - in minutes
- totalMarks (INTEGER)
- passingMarks (INTEGER)
- instructions (TEXT)
- status (TEXT: 'draft', 'published')
- startTime, endTime (DATETIME)
- createdAt, updatedAt (DATETIME)
```

### Exam Sessions Table
```sql
- id (TEXT, PRIMARY KEY) - format: {studentId}_{examId}_{timestamp}
- examId, studentId (FOREIGN KEYS)
- startTime, endTime (DATETIME)
- status (TEXT: 'active', 'completed', 'abandoned')
- totalViolations (INTEGER)
- suspicionScore (REAL)
```

### Submissions Table
```sql
- id (INTEGER, PRIMARY KEY)
- sessionId (TEXT, FOREIGN KEY)
- questionId (INTEGER, FOREIGN KEY)
- answer (TEXT)
- marks (INTEGER)
- isAutoGraded, isManuallyGraded (BOOLEAN)
- gradedBy (INTEGER, FOREIGN KEY to users)
- feedback (TEXT)
- firstAnswerTime, lastAnswerTime (INTEGER) - timestamps
- changeCount (INTEGER)
```

### Violation Logs Table
```sql
- id (INTEGER, PRIMARY KEY)
- sessionId (TEXT, FOREIGN KEY)
- violationType (TEXT) - e.g., 'tab_switch_away', 'fullscreen_exit'
- timestamp (DATETIME)
- details (JSON)
- severity (TEXT: 'high', 'medium', 'low')
```

### Activity Logs Table
```sql
- id (INTEGER, PRIMARY KEY)
- sessionId (TEXT, FOREIGN KEY)
- eventType (TEXT) - e.g., 'question_view', 'answer_submitted'
- timestamp (DATETIME)
- details (JSON)
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Exams
- `POST /api/exams` - Create exam (organizer only)
- `GET /api/exams` - List organizer's exams
- `GET /api/exams/:examId` - Get exam details
- `GET /api/exams/:examId/full` - Get exam with questions (for student)
- `PUT /api/exams/:examId` - Update exam (organizer only)
- `DELETE /api/exams/:examId` - Delete exam (organizer only)
- `GET /api/exams/:examId/students` - Get enrolled students

### Questions
- `POST /api/questions` - Create question (organizer only)
- `GET /api/questions/exam/:examId` - Get questions for exam
- `GET /api/questions/:questionId` - Get question details
- `DELETE /api/questions/:questionId` - Delete question (organizer only)

### Submissions
- `POST /api/submissions/session/start` - Start exam session
- `POST /api/submissions/answer` - Submit answer
- `GET /api/submissions/session/:sessionId/submissions` - Get all submissions
- `POST /api/submissions/session/:sessionId/end` - End exam and get results
- `GET /api/submissions/session/:sessionId/results` - Get exam results

### Logs
- `POST /api/logs/activity` - Log student activity
- `POST /api/logs/violation` - Log violation
- `GET /api/logs/exam/:examId/violations` - Get violations for exam
- `GET /api/logs/session/:sessionId/activity` - Get activity logs
- `GET /api/logs/session/:sessionId/violations` - Get violations for session

## WebSocket Events

### Student → Server
- `exam_start` - Student starts exam
- `log_violation` - Violation detected
- `activity` - Update activity
- `exam_end` - Student ends exam

### Server → Organizer (Broadcasting)
- `student_status_update` - Student status changed
- `violation_logged` - New violation detected
- `student_status_update` - Final status update

## Security Features

1. **Authentication**: JWT tokens with 7-day expiration
2. **Password Hashing**: bcryptjs with salt rounds
3. **Role-Based Access Control**: Endpoints verified for user role
4. **CORS**: Enabled for frontend-backend communication
5. **Anti-Cheating**: Multi-layer detection system

## Performance Considerations

1. **Database Indexing**: Exams and sessions are indexed by ID
2. **Question Randomization**: Done client-side to reduce server load
3. **WebSocket Optimization**: Only updates when necessary
4. **Auto-grading**: Immediate for MCQs, backend processed
5. **Session Cleanup**: Sessions properly closed on disconnect

## Future Enhancements

1. **Webcam Proctoring**: Using WebRTC for periodic snapshots
2. **Face Detection**: ML-based face recognition for identity verification
3. **Advanced Analytics**: Suspicion score calculation algorithm
4. **Question Shuffling**: Random question order per student
5. **Answer Versioning**: Track all answer versions with timestamps
6. **Email Notifications**: Exam completion and result notifications
7. **Mobile App**: Native apps for iOS/Android
8. **Integration**: LMS integration (Canvas, Blackboard, Moodle)
9. **Advanced Reporting**: Custom reports and data export
10. **Accessibility**: WCAG 2.1 AA compliance improvements

## Troubleshooting

### Server won't start
- Check if port 5001 is available
- Run `npm install` to ensure dependencies
- Check Node.js version

### Database errors
- Delete `data/protexam.db` to reset
- Database will be recreated on startup

### Fullscreen not working
- Some browsers require user gesture
- Firefox: Allow fullscreen for localhost
- Chrome: Allow fullscreen in permissions

### WebSocket connection issues
- Check if Socket.io is properly loaded
- Browser console should show connection logs
- Verify port 5001 is accessible

## Notes for Developers

1. **Code Organization**: Clean separation of concerns between frontend and backend
2. **Error Handling**: Try-catch blocks with user-friendly messages
3. **Logging**: Console logs for debugging, database logs for audit trail
4. **Validation**: Input validation on both client and server
5. **Comments**: Clear comments explaining complex logic

## License

MIT License - Feel free to use for educational purposes

## Support & Contact

For issues or suggestions, please refer to the inline code comments for implementation details.

---

**ProExam** - Ensuring Academic Integrity Through Technology
