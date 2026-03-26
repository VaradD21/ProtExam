# ProExam API Documentation

Complete REST API reference for ProExam online examination system.

## Base URL
```
http://localhost:5001/api
```

## Authentication
All endpoints (except auth endpoints) require JWT token in header:
```
Authorization: Bearer {token}
```

Token is received on login/register and valid for 7 days.

---

## Authentication Endpoints

### Register User
**Endpoint**: `POST /auth/register`

**Request**:
```json
{
  "email": "student@example.com",
  "password": "securepassword123",
  "fullName": "John Doe",
  "role": "student"
}
```

**Response** (201):
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "fullName": "John Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Login User
**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "student@example.com",
  "password": "securepassword123"
}
```

**Response** (200):
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "fullName": "John Doe",
    "role": "student"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Get Current User
**Endpoint**: `GET /auth/me`

**Headers**: Requires Bearer token

**Response** (200):
```json
{
  "id": 1,
  "email": "student@example.com",
  "fullName": "John Doe",
  "role": "student"
}
```

---

## Exam Endpoints

### Create Exam
**Endpoint**: `POST /exams`

**Required Role**: Organizer

**Request**:
```json
{
  "title": "Advanced Mathematics",
  "description": "Test covering algebra, geometry, and calculus",
  "duration": 120,
  "totalMarks": 100,
  "passingMarks": 40,
  "instructions": "Negative marking: -0.25 for wrong answers"
}
```

**Response** (201):
```json
{
  "examId": 5,
  "message": "Exam created successfully"
}
```

---

### Get All Exams (Organizer)
**Endpoint**: `GET /exams`

**Required Role**: Organizer

**Response** (200):
```json
[
  {
    "id": 1,
    "organizerId": 1,
    "title": "Mathematics Test",
    "description": "...",
    "duration": 60,
    "totalMarks": 100,
    "passingMarks": 40,
    "status": "published",
    "createdAt": "2024-03-25T10:00:00Z"
  },
  ...
]
```

---

### Get Exam Details
**Endpoint**: `GET /exams/:examId`

**Response** (200):
```json
{
  "id": 1,
  "organizerId": 1,
  "title": "Mathematics Test",
  "description": "...",
  "duration": 60,
  "totalMarks": 100,
  "passingMarks": 40,
  "instructions": "...",
  "status": "published",
  "startTime": null,
  "endTime": null,
  "createdAt": "2024-03-25T10:00:00Z"
}
```

---

### Get Exam with Questions (Student View)
**Endpoint**: `GET /exams/:examId/full`

**Response** (200):
```json
{
  "id": 1,
  "title": "Mathematics Test",
  "description": "...",
  "duration": 60,
  "totalMarks": 100,
  "passingMarks": 40,
  "instructions": "...",
  "questions": [
    {
      "id": 10,
      "examId": 1,
      "type": "mcq",
      "content": "What is 2+2?",
      "marks": 1,
      "options": [
        {
          "id": 1,
          "questionId": 10,
          "optionText": "3"
        },
        {
          "id": 2,
          "questionId": 10,
          "optionText": "4"
        }
      ]
    },
    {
      "id": 11,
      "examId": 1,
      "type": "descriptive",
      "content": "Explain photosynthesis",
      "marks": 5
    }
  ]
}
```

---

### Update Exam
**Endpoint**: `PUT /exams/:examId`

**Required Role**: Organizer

**Request** (partial update):
```json
{
  "title": "Updated Title",
  "status": "published"
}
```

**Response** (200):
```json
{
  "message": "Exam updated successfully"
}
```

---

### Delete Exam
**Endpoint**: `DELETE /exams/:examId`

**Required Role**: Organizer

**Response** (200):
```json
{
  "message": "Exam deleted successfully"
}
```

---

### Get Enrolled Students
**Endpoint**: `GET /exams/:examId/students`

**Required Role**: Organizer

**Response** (200):
```json
[
  {
    "id": 2,
    "email": "student1@example.com",
    "fullName": "John Doe"
  },
  {
    "id": 3,
    "email": "student2@example.com",
    "fullName": "Jane Smith"
  }
]
```

---

### Enroll Student in Exam
**Endpoint**: `POST /exams/:examId/enroll`

**Required Role**: Organizer

**Request**:
```json
{
  "studentId": 5
}
```

**Response** (200):
```json
{
  "message": "Student enrolled successfully"
}
```

---

## Question Endpoints

### Create Question
**Endpoint**: `POST /questions`

**Required Role**: Organizer

**Request** (MCQ):
```json
{
  "examId": 1,
  "type": "mcq",
  "content": "What is the capital of France?",
  "marks": 2,
  "orderNum": 1,
  "options": [
    {
      "text": "London",
      "isCorrect": false
    },
    {
      "text": "Paris",
      "isCorrect": true
    },
    {
      "text": "Berlin",
      "isCorrect": false
    }
  ]
}
```

**Request** (Descriptive):
```json
{
  "examId": 1,
  "type": "descriptive",
  "content": "Write an essay on climate change",
  "marks": 10,
  "orderNum": 2
}
```

**Response** (201):
```json
{
  "questionId": 45,
  "message": "Question created successfully"
}
```

---

### Get Questions for Exam
**Endpoint**: `GET /questions/exam/:examId`

**Response** (200):
```json
[
  {
    "id": 1,
    "examId": 5,
    "type": "mcq",
    "content": "What is 2+2?",
    "marks": 1,
    "orderNum": 1,
    "options": [
      {
        "id": 1,
        "questionId": 1,
        "optionText": "4",
        "isCorrect": true
      }
    ]
  }
]
```

---

### Delete Question
**Endpoint**: `DELETE /questions/:questionId`

**Required Role**: Organizer

**Response** (200):
```json
{
  "message": "Question deleted successfully"
}
```

---

## Submission Endpoints

### Start Exam Session
**Endpoint**: `POST /submissions/session/start`

**Required Role**: Student

**Request**:
```json
{
  "examId": 1
}
```

**Response** (200):
```json
{
  "sessionId": "2_1_1711353600000",
  "message": "Exam session started"
}
```

---

### Submit Answer
**Endpoint**: `POST /submissions/answer`

**Required Role**: Student

**Request**:
```json
{
  "sessionId": "2_1_1711353600000",
  "questionId": 10,
  "answer": "4",
  "firstAnswerTime": 1711353605001,
  "lastAnswerTime": 1711353610000,
  "changeCount": 1
}
```

**Response** (200):
```json
{
  "message": "Answer saved",
  "submissionId": 42
}
```

---

### Get Submissions for Session
**Endpoint**: `GET /submissions/session/:sessionId/submissions`

**Response** (200):
```json
[
  {
    "id": 1,
    "sessionId": "2_1_1711353600000",
    "questionId": 10,
    "answer": "4",
    "marks": 1,
    "isAutoGraded": true,
    "isManuallyGraded": false,
    "changeCount": 1,
    "createdAt": "2024-03-25T10:00:05Z",
    "updatedAt": "2024-03-25T10:00:10Z"
  }
]
```

---

### End Exam Session
**Endpoint**: `POST /submissions/session/:sessionId/end`

**Required Role**: Student

**Request**:
```json
{
  "totalViolations": 2
}
```

**Response** (200):
```json
{
  "message": "Exam completed",
  "results": {
    "id": "2_1_1711353600000",
    "examId": 1,
    "studentId": 2,
    "startTime": "2024-03-25T10:00:00Z",
    "endTime": "2024-03-25T11:00:00Z",
    "status": "completed",
    "totalViolations": 2,
    "totalMarks": 45
  }
}
```

---

### Get Exam Results
**Endpoint**: `GET /submissions/session/:sessionId/results`

**Response** (200):
```json
{
  "session": {
    "id": "2_1_1711353600000",
    "examId": 1,
    "studentId": 2,
    "startTime": "2024-03-25T10:00:00Z",
    "endTime": "2024-03-25T11:00:00Z",
    "status": "completed",
    "totalViolations": 2,
    "suspicionScore": 0.15,
    "totalMarks": 45
  },
  "submissions": [
    {
      "id": 1,
      "sessionId": "2_1_1711353600000",
      "questionId": 10,
      "answer": "4",
      "marks": 1,
      "isAutoGraded": true,
      "feedback": null,
      "changeCount": 0
    }
  ]
}
```

---

## Logging Endpoints

### Log Activity
**Endpoint**: `POST /logs/activity`

**Request**:
```json
{
  "sessionId": "2_1_1711353600000",
  "eventType": "question_view",
  "timestamp": 1711353600000,
  "details": {
    "questionId": 10,
    "questionNumber": 1,
    "questionType": "mcq"
  }
}
```

**Response** (200):
```json
{
  "message": "Activity logged"
}
```

---

### Log Violation
**Endpoint**: `POST /logs/violation`

**Request**:
```json
{
  "sessionId": "2_1_1711353600000",
  "violationType": "tab_switch_away",
  "timestamp": 1711353605001,
  "details": {
    "hidden": true
  },
  "severity": "high"
}
```

**Response** (200):
```json
{
  "message": "Violation logged"
}
```

---

### Get Violations for Exam
**Endpoint**: `GET /logs/exam/:examId/violations`

**Required Role**: Organizer

**Response** (200):
```json
[
  {
    "id": 1,
    "sessionId": "2_1_1711353600000",
    "violationType": "tab_switch_away",
    "timestamp": "2024-03-25T10:00:05Z",
    "severity": "high",
    "details": "{\"hidden\": true}"
  }
]
```

---

### Get Activity Logs for Session
**Endpoint**: `GET /logs/session/:sessionId/activity`

**Response** (200):
```json
[
  {
    "id": 1,
    "sessionId": "2_1_1711353600000",
    "eventType": "question_view",
    "timestamp": "2024-03-25T10:00:00Z",
    "details": "{\"questionId\": 10, \"questionNumber\": 1}"
  }
]
```

---

### Get Violations for Session
**Endpoint**: `GET /logs/session/:sessionId/violations`

**Response** (200):
```json
[
  {
    "id": 1,
    "sessionId": "2_1_1711353600000",
    "violationType": "tab_switch_away",
    "timestamp": "2024-03-25T10:00:05Z",
    "severity": "high"
  },
  {
    "id": 2,
    "sessionId": "2_1_1711353600000",
    "violationType": "copy_attempt",
    "timestamp": "2024-03-25T10:05:10Z",
    "severity": "medium"
  }
]
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Exam not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## WebSocket Events

### Client → Server

**exam_start**
```javascript
socket.emit('exam_start', {
  studentId: 2,
  examId: 1,
  sessionId: "2_1_1711353600000"
});
```

**log_violation**
```javascript
socket.emit('log_violation', {
  sessionId: "2_1_1711353600000",
  violationType: 'tab_switch_away',
  timestamp: Date.now(),
  details: { hidden: true }
});
```

**activity**
```javascript
socket.emit('activity', {
  sessionId: "2_1_1711353600000"
});
```

**exam_end**
```javascript
socket.emit('exam_end', {
  sessionId: "2_1_1711353600000"
});
```

### Server → Client (Broadcasting)

**student_status_update**
```javascript
{
  sessionId: "2_1_1711353600000",
  studentId: 2,
  examId: 1,
  status: 'active',
  violations: 2,
  startTime: 1711353600000,
  lastActivity: 1711353610000,
  lastViolation: 'tab_switch_away',
  lastViolationTime: 1711353605001
}
```

**violation_logged**
```javascript
{
  sessionId: "2_1_1711353600000",
  violationType: 'tab_switch_away',
  timestamp: 1711353605001,
  studentStatus: { /* student status object */ }
}
```

---

## Rate Limiting
Currently not implemented. Recommend adding:
- 100 requests per minute for public endpoints
- 1000 requests per minute for authenticated endpoints

---

## CORS Configuration
Enabled for all origins. In production, restrict to your domain:
```javascript
cors: {
  origin: 'https://yourdomain.com'
}
```

---

## Pagination
Not implemented. All endpoints return full results.
For large datasets, add `?limit=50&offset=0` parameters.

---

## Versioning
Current API version: v1

For future versions, use `/api/v2/...` endpoints.

---

## Changelog

### v1.0 (Current)
- Initial release
- Authentication system
- Exam management
- Question bank
- Submission handling
- Anti-cheating detection
- Logging system
- WebSocket monitoring

---

Last updated: March 25, 2024
