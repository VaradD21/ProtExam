const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/protexam.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database error:', err);
    return;
  }
  console.log('Connected to database');
});

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err);
    return;
  }

  console.log('Tables:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });

  // Check questions table schema
  db.all("PRAGMA table_info(questions)", [], (err, columns) => {
    if (err) {
      console.error('Error getting questions table info:', err);
      return;
    }

    console.log('\nQuestions table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type})`);
    });

    // Check question_options table schema
    db.all("PRAGMA table_info(question_options)", [], (err, columns) => {
      if (err) {
        console.error('Error getting question_options table info:', err);
        return;
      }

      console.log('\nQuestion_options table columns:');
      columns.forEach(col => {
        console.log(`- ${col.name} (${col.type})`);
      });

      // Check enrollments table schema
      db.all("PRAGMA table_info(enrollments)", [], (err, columns) => {
        if (err) {
          console.error('Error getting enrollments table info:', err);
          return;
        }

        console.log('\nEnrollments table columns:');
        columns.forEach(col => {
          console.log(`- ${col.name} (${col.type})`);
        });

        db.close();
      });
    });
  });
});