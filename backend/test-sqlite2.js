import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('./data/local.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id FROM courses", (err, rows) => {
  if (err) console.error(err);
  else console.log('courses:', rows.map(r => r.id));
});

db.all("SELECT id FROM lessons", (err, rows) => {
  if (err) console.error(err);
  else console.log('lessons:', rows.map(r => r.id));
});

db.all("SELECT id FROM centers", (err, rows) => {
  if (err) console.error(err);
  else console.log('centers:', rows.map(r => r.id));
});
