import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('./data/local.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS attendance_sessions;", (err) => {
    if (err) console.error('Error dropping table:', err);
    else console.log('Successfully dropped attendance_sessions table.');
  });
});
