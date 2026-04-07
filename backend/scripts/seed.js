const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../data/protexam.db');

// Sample data for seeding
const sampleData = {
  users: [
    // Organizers
    { email: 'admin@protexam.com', password: 'admin123', fullName: 'System Administrator', role: 'organizer' },
    { email: 'prof.smith@university.edu', password: 'prof123', fullName: 'Dr. Sarah Smith', role: 'organizer' },
    { email: 'dr.johnson@college.edu', password: 'john123', fullName: 'Prof. Michael Johnson', role: 'organizer' },

    // Students
    { email: 'alice.student@email.com', password: 'alice123', fullName: 'Alice Johnson', role: 'student' },
    { email: 'bob.student@email.com', password: 'bob123', fullName: 'Bob Wilson', role: 'student' },
    { email: 'charlie.student@email.com', password: 'charlie123', fullName: 'Charlie Brown', role: 'student' },
    { email: 'diana.student@email.com', password: 'diana123', fullName: 'Diana Prince', role: 'student' },
    { email: 'eve.student@email.com', password: 'eve123', fullName: 'Eve Martinez', role: 'student' },
    { email: 'frank.student@email.com', password: 'frank123', fullName: 'Frank Miller', role: 'student' },
    { email: 'grace.student@email.com', password: 'grace123', fullName: 'Grace Lee', role: 'student' },
    { email: 'henry.student@email.com', password: 'henry123', fullName: 'Henry Davis', role: 'student' }
  ],

  exams: [
    {
      title: 'Introduction to Computer Science',
      description: 'Basic concepts of programming, algorithms, and data structures',
      duration: 90,
      totalMarks: 100,
      passingMarks: 60,
      instructions: 'This exam covers fundamental programming concepts. You have 90 minutes to complete all questions.',
      weightage: 1.0,
      rules: 'No external resources allowed. Calculator permitted for mathematical questions.',
      shuffleQuestions: true,
      shuffleOptions: true,
      allowReview: true,
      showResultsImmediately: false,
      maxAttempts: 2,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      accessCode: 'CS101'
    },
    {
      title: 'Advanced Mathematics',
      description: 'Calculus, linear algebra, and discrete mathematics',
      duration: 120,
      totalMarks: 150,
      passingMarks: 90,
      instructions: 'Advanced mathematical concepts and problem-solving. Show all work for partial credit.',
      weightage: 1.5,
      rules: 'Graphing calculator required. Formula sheet provided.',
      shuffleQuestions: false,
      shuffleOptions: false,
      allowReview: false,
      showResultsImmediately: true,
      maxAttempts: 1,
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (active)
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      accessCode: 'MATH201'
    },
    {
      title: 'Database Systems',
      description: 'SQL, database design, and data management',
      duration: 75,
      totalMarks: 80,
      passingMarks: 48,
      instructions: 'Focus on practical database concepts and SQL queries.',
      weightage: 1.0,
      rules: 'No internet access. Database schema will be provided.',
      shuffleQuestions: true,
      shuffleOptions: true,
      allowReview: true,
      showResultsImmediately: false,
      maxAttempts: 3,
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      accessCode: 'DB301'
    },
    {
      title: 'Web Development Fundamentals',
      description: 'HTML, CSS, JavaScript, and responsive design',
      duration: 60,
      totalMarks: 70,
      passingMarks: 35,
      instructions: 'Build a complete responsive website using modern web technologies.',
      weightage: 0.8,
      rules: 'Code editor provided. No external libraries except those specified.',
      shuffleQuestions: false,
      shuffleOptions: false,
      allowReview: true,
      showResultsImmediately: true,
      maxAttempts: 2,
      startDate: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago (active)
      endDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      accessCode: 'WEB101'
    },
    {
      title: 'Data Structures & Algorithms',
      description: 'Advanced algorithms, complexity analysis, and optimization',
      duration: 105,
      totalMarks: 120,
      passingMarks: 72,
      instructions: 'Analyze algorithm efficiency and implement optimal solutions.',
      weightage: 1.2,
      rules: 'Pseudocode or any programming language acceptable.',
      shuffleQuestions: true,
      shuffleOptions: false,
      allowReview: false,
      showResultsImmediately: false,
      maxAttempts: 1,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
      endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      accessCode: 'DSA401'
    }
  ],

  questions: {
    1: [ // CS101 questions
      {
        type: 'mcq',
        content: 'What is the time complexity of binary search?',
        marks: 5,
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
        correctAnswer: 'O(log n)'
      },
      {
        type: 'mcq',
        content: 'Which data structure uses LIFO (Last In, First Out) principle?',
        marks: 5,
        options: ['Queue', 'Stack', 'Array', 'Linked List'],
        correctAnswer: 'Stack'
      },
      {
        type: 'descriptive',
        content: 'Explain the difference between compiled and interpreted languages. Give examples of each.',
        marks: 10
      },
      {
        type: 'mcq',
        content: 'What does SQL stand for?',
        marks: 5,
        options: ['Simple Query Language', 'Structured Query Language', 'Standard Question Language', 'System Query Language'],
        correctAnswer: 'Structured Query Language'
      }
    ],
    2: [ // MATH201 questions
      {
        type: 'descriptive',
        content: 'Solve the differential equation: dy/dx = 2x + 3, with initial condition y(0) = 5.',
        marks: 15
      },
      {
        type: 'mcq',
        content: 'What is the determinant of a 2x2 identity matrix?',
        marks: 10,
        options: ['0', '1', '2', 'Undefined'],
        correctAnswer: '1'
      },
      {
        type: 'descriptive',
        content: 'Prove that the set of all 2x2 matrices with real entries forms a vector space over the real numbers.',
        marks: 20
      }
    ],
    3: [ // DB301 questions
      {
        type: 'descriptive',
        content: 'Write an SQL query to find all students who have taken at least 3 exams and have an average score above 80.',
        marks: 15
      },
      {
        type: 'mcq',
        content: 'Which normal form eliminates transitive dependencies?',
        marks: 10,
        options: ['1NF', '2NF', '3NF', 'BCNF'],
        correctAnswer: '3NF'
      },
      {
        type: 'descriptive',
        content: 'Explain the concept of database indexing and its impact on query performance.',
        marks: 15
      }
    ],
    4: [ // WEB101 questions
      {
        type: 'mcq',
        content: 'Which CSS property is used to create responsive layouts?',
        marks: 5,
        options: ['position', 'display', 'flexbox', 'media queries'],
        correctAnswer: 'media queries'
      },
      {
        type: 'descriptive',
        content: 'Create a simple HTML form with validation for user registration (name, email, password).',
        marks: 15
      },
      {
        type: 'mcq',
        content: 'What does DOM stand for?',
        marks: 5,
        options: ['Document Object Model', 'Data Object Management', 'Dynamic Object Method', 'Document Order Model'],
        correctAnswer: 'Document Object Model'
      }
    ],
    5: [ // DSA401 questions
      {
        type: 'descriptive',
        content: 'Implement a function to find the shortest path in an unweighted graph using BFS. Provide time and space complexity analysis.',
        marks: 25
      },
      {
        type: 'mcq',
        content: 'Which sorting algorithm has the best average case time complexity?',
        marks: 10,
        options: ['Bubble Sort', 'Quick Sort', 'Insertion Sort', 'Selection Sort'],
        correctAnswer: 'Quick Sort'
      },
      {
        type: 'descriptive',
        content: 'Explain the master theorem and use it to solve T(n) = 2T(n/2) + n.',
        marks: 20
      }
    ]
  }
};

async function seedDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }
      console.log('Connected to database for seeding');
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Add missing columns if they don't exist
    db.run('ALTER TABLE question_options ADD COLUMN isCorrect BOOLEAN DEFAULT 0', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding isCorrect column:', err);
      } else {
        console.log('✓ Ensured isCorrect column exists');
      }
    });

    let completedOperations = 0;
    const totalOperations = 3; // users, exams, questions

    // Seed users
    console.log('Seeding users...');
    (async () => {
      let userCount = 0;
      for (const user of sampleData.users) {
        try {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT OR IGNORE INTO users (email, password, fullName, role) VALUES (?, ?, ?, ?)',
              [user.email, hashedPassword, user.fullName, user.role],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          userCount++;
        } catch (err) {
          console.error('Error seeding user:', err);
        }
      }
      if (userCount === sampleData.users.length) {
        console.log(`✓ Seeded ${userCount} users`);
        checkCompletion();
      }
    })();

    // Seed exams
    console.log('Seeding exams...');
    let examCount = 0;
    sampleData.exams.forEach(exam => {
      db.run(
        `INSERT OR IGNORE INTO exams (organizerId, title, description, duration, totalMarks, passingMarks, instructions, status,
                                      weightage, rules, shuffle_questions, shuffle_options, allow_review, show_results_immediately,
                                      max_attempts, start_date, end_date, access_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [1, exam.title, exam.description, exam.duration, exam.totalMarks, exam.passingMarks, exam.instructions, 'active',
         exam.weightage, exam.rules, exam.shuffleQuestions, exam.shuffleOptions, exam.allowReview,
         exam.showResultsImmediately, exam.maxAttempts, exam.startDate, exam.endDate, exam.accessCode],
        function(err) {
          if (err) {
            console.error('Error seeding exam:', err);
            return;
          }
          examCount++;
          if (examCount === sampleData.exams.length) {
            console.log(`✓ Seeded ${examCount} exams`);
            checkCompletion();
          }
        }
      );
    });

    // Seed questions after exams are done
    function seedQuestions() {
      console.log('Seeding questions...');
      let totalQuestions = 0;
      let totalOptions = 0;
      const allQuestions = Object.values(sampleData.questions).flat();
      const totalItems = allQuestions.length + allQuestions.filter(q => q.type === 'mcq').reduce((sum, q) => sum + q.options.length, 0);

      Object.keys(sampleData.questions).forEach(examIndex => {
        const examId = parseInt(examIndex);
        const questions = sampleData.questions[examId];

        questions.forEach((question, questionIndex) => {
          db.run(
            'INSERT OR IGNORE INTO questions (examId, type, content, marks, orderNum) VALUES (?, ?, ?, ?, ?)',
            [examId, question.type, question.content, question.marks, questionIndex + 1],
            function(err) {
              if (err) {
                console.error('Error seeding question:', err);
                return;
              }
              const questionId = this.lastID;
              totalQuestions++;

              // If MCQ, add options
              if (question.type === 'mcq' && question.options) {
                question.options.forEach((optionText, optionIndex) => {
                  const isCorrect = optionText === question.correctAnswer ? 1 : 0;
                  db.run(
                    'INSERT OR IGNORE INTO question_options (questionId, optionText, isCorrect) VALUES (?, ?, ?)',
                    [questionId, optionText, isCorrect],
                    function(err) {
                      if (err) {
                        console.error('Error seeding option:', err);
                        return;
                      }
                      totalOptions++;
                      checkQuestionCompletion();
                    }
                  );
                });
              } else {
                checkQuestionCompletion();
              }

              function checkQuestionCompletion() {
                if (totalQuestions + totalOptions === totalItems) {
                  console.log(`✓ Seeded ${totalQuestions} questions and ${totalOptions} options`);
                  seedEnrollments();
                }
              }
            }
          );
        });
      });
    }

    // Seed enrollments
    function seedEnrollments() {
      console.log('Seeding enrollments...');
      // Get all students and exams
      db.all('SELECT id FROM users WHERE role = "student"', [], (err, students) => {
        if (err) {
          console.error('Error getting students:', err);
          return;
        }

        db.all('SELECT id FROM exams', [], (err, exams) => {
          if (err) {
            console.error('Error getting exams:', err);
            return;
          }

          let enrollmentCount = 0;
          const totalEnrollments = students.length * exams.length;

          students.forEach(student => {
            exams.forEach(exam => {
              db.run(
                'INSERT OR IGNORE INTO enrollments (examId, studentId) VALUES (?, ?)',
                [exam.id, student.id],
                function(err) {
                  if (err) {
                    console.error('Error seeding enrollment:', err);
                    return;
                  }
                  enrollmentCount++;
                  if (enrollmentCount === totalEnrollments) {
                    console.log(`✓ Seeded ${enrollmentCount} enrollments`);
                    checkCompletion();
                  }
                }
              );
            });
          });
        });
      });
    }

    function checkCompletion() {
      completedOperations++;
      if (completedOperations === totalOperations) {
        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📋 Test Accounts:');
        console.log('Organizers:');
        console.log('  admin@protexam.com / admin123');
        console.log('  prof.smith@university.edu / prof123');
        console.log('  dr.johnson@college.edu / john123');
        console.log('\nStudents:');
        console.log('  alice.student@email.com / alice123');
        console.log('  bob.student@email.com / bob123');
        console.log('  charlie.student@email.com / charlie123');
        console.log('  diana.student@email.com / diana123');
        console.log('  eve.student@email.com / eve123');
        console.log('  frank.student@email.com / frank123');
        console.log('  grace.student@email.com / grace123');
        console.log('  henry.student@email.com / henry123');

        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      }
    }

    // Start seeding questions after a short delay to ensure exams are inserted
    setTimeout(() => {
      seedQuestions();
    }, 100);
  });
}

// Run seeding if this script is executed directly
if (require.main === module) {
  console.log('🌱 Starting database seeding...');
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };