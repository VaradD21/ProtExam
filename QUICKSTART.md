# Quick Start Guide - ProExam

## Get Running in 5 Minutes

### 1. Install Dependencies
```bash
cd protexam/backend
npm install
```

### 2. Start the Server
```bash
npm start
```

You should see:
```
ProExam server running on port 5001
Organizer: http://localhost:5001/organizer/
Student: http://localhost:5001/student/
Login: http://localhost:5001/login.html
```

### 3. Open in Browser
- Login: http://localhost:5001/login.html

### 4. Create Test Accounts

#### Organizer Account
1. Click role selector → choose "Organizer"
2. Click "Register"
3. Enter:
   - Email: `organizer@test.com`
   - Password: `password123`
   - Full Name: `Test Organizer`
4. Click Register

You're now logged in as organizer!

#### Student Account
1. Go back to login
2. Click role selector → choose "Student"  
3. Click "Register"
4. Enter:
   - Email: `student1@test.com`
   - Password: `password123`
   - Full Name: `Test Student`
5. Click Register

### 5. Create Your First Exam (as Organizer)

1. Go to **Exams** tab
2. Click **"+ Create New Exam"**
3. Fill in:
   - Title: "Math Test"
   - Duration: 30 minutes
   - Total Marks: 100
   - Passing Marks: 40
4. Click **Save Exam**

### 6. Add Questions

1. In Exams tab, click **Questions** on your exam
2. Click **"+ Add Question"**
3. Add an MCQ:
   - Type: Multiple Choice
   - Question: "What is 2+2?"
   - Marks: 5
   - Options: Add "4", "5", "6", "7" (mark "4" as correct)
4. Click **Save Question**
5. Add a Descriptive Question:
   - Type: Descriptive
   - Question: "Explain the Pythagorean theorem"
   - Marks: 10
6. Click **Save Question**
7. Close modal

### 7. Take Exam (as Student)

1. **Log out** as organizer
2. **Log in** as student (student1@test.com)
3. You see "Available Exams" page
4. Click **Start Exam** on "Math Test"
5. Confirm fullscreen entry
6. Answer both questions
7. Click **Submit Exam**

### 8. View Results

Results show automatically with:
- Your score
- Percentage
- Pass/Fail status
- Question analysis
- Violations detected

### 9. Monitor Students (as Organizer)

1. Log back in as organizer
2. Go to **Monitoring** tab
3. Select "Math Test" exam
4. See student status, violations, and details

---

## Common Tasks

### Publish an Exam
1. Go to Exams tab
2. Click Edit on exam
3. Change status to "Published" (in code)
4. Save

### Grade Descriptive Answers
1. Go to Results tab
2. Select exam
3. Find student answer
4. Add marks and feedback (API endpoint ready)

### View Violation Report
1. Monitoring tab → Select exam
2. Click "Details" on student
3. See all violations with timestamps

---

## Anti-Cheating in Action

Try these to see violations detected:

1. **Tab Switch**: Click another browser tab → Violation logged
2. **Copy Attempt**: Try Ctrl+C → Warning shown
3. **Paste Attempt**: Try Ctrl+V → Warning shown  
4. **Right-Click**: Try right-click → Menu disabled
5. **Fullscreen Exit**: Press F11 → Violation logged
6. **Devtools**: Press F12 → Blocked with warning

After 3 violations → **Auto-Submit** triggered!

---

## Database Reset

Delete the database and it will recreate:
```bash
rm data/protexam.db
npm start
```

---

## Stop the Server

Press `Ctrl+C` in terminal

---

## Access Other Pages

- **Organizer Dashboard**: http://localhost:5001/organizer/
- **Student Exam List**: http://localhost:5001/student/
- **Results Page**: http://localhost:5001/student/results.html

---

## Troubleshooting

**Port 5001 already in use?**
```bash
# Change port in server.js line at bottom:
const PORT = process.env.PORT || 3000;
```

**Can't create exam?**
- Make sure you're logged in as organizer
- Check browser console for errors (F12)

**Exam won't load in student mode?**
- Refresh page
- Check browser console
- Verify exam was created successfully

**Fullscreen not working?**
- Some browsers need permission
- Try Chrome or Firefox
- Check browser settings

---

## What's Working

✅ Complete authentication system  
✅ Exam creation and management  
✅ Question bank (MCQ & descriptive)  
✅ Fullscreen enforcement  
✅ Tab switching detection  
✅ Copy/paste prevention  
✅ Right-click disabled  
✅ Keyboard shortcut blocking  
✅ Anti-cheating logging  
✅ Auto-grading MCQs  
✅ Exam results page  
✅ Violation reporting  
✅ Activity logging  
✅ Student monitoring  
✅ Database persistence  

---

## What's Next to Enhance

- Webcam snapshots
- Face recognition
- Advanced suspicion scoring
- Email notifications
- Export reports to PDF
- Question randomization per student
- Mobile app version
- LMS integration

---

Enjoy ProExam! 🎓
