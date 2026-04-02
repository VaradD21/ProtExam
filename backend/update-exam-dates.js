const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/protexam.db');

db.run(`UPDATE exams SET end_date = '2026-04-10T23:59:59.999Z' WHERE id IN (2,3,4,5,6,8,9,10)`, (err) => {
  if (err) {
    console.error('Error updating exams:', err);
  } else {
    console.log('Successfully updated exam end dates');
  }
  db.close();
});