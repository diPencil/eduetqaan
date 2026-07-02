import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env') });

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');
const headers = { 
  Authorization: 'Bearer ' + token,
  'Content-Type': 'application/json'
};

async function test() {
  try {
    // get a course
    const cRes = await fetch('http://localhost:12011/api/v1/courses?status=published', { headers });
    const cJson = await cRes.json();
    const courseId = cJson.data[0].id;
    console.log('courseId', courseId);

    // get lesson for course
    const lRes = await fetch(`http://localhost:12011/api/v1/courses/${courseId}/lessons`, { headers });
    const lJson = await lRes.json();
    const lessonId = lJson.data[0].id;
    console.log('lessonId', lessonId);

    const data = {
      centerId: 1,
      courseId,
      lessonId,
      level: '3sec'
    };
    const res = await fetch('http://localhost:12011/api/v1/center-attendance/sessions/start', { 
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const text = await res.text();
    console.log('Start Session:', res.status, text.substring(0, 2000));
  } catch (err) {
    console.error(err);
  }
}
test();
