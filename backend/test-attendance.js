import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env') });

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');
const headers = { Authorization: 'Bearer ' + token };

async function test() {
  try {
    const res1 = await fetch('http://localhost:12011/api/v1/center-attendance/sessions', { headers });
    const text1 = await res1.text();
    console.log('Sessions:', res1.status, text1.substring(0, 200));

    const res2 = await fetch('http://localhost:12011/api/v1/center-attendance-course/centers/1/students?level=3sec', { headers });
    const text2 = await res2.text();
    console.log('Center Students:', res2.status, text2.substring(0, 200));

    const res3 = await fetch('http://localhost:12011/api/v1/attendance/lesson-roster?centerId=1', { headers });
    const text3 = await res3.text();
    console.log('Lesson Roster:', res3.status, text3.substring(0, 200));

  } catch (err) {
    console.error(err);
  }
}
test();
