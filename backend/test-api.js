import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env') });

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');
const headers = { Authorization: 'Bearer ' + token };

async function test() {
  try {
    const res = await fetch('http://localhost:12011/api/v1/courses?status=published', { headers });
    const text = await res.text();
    console.log('Courses:', res.status, text);

    const res2 = await fetch('http://localhost:12011/api/v1/centers?active=true', { headers });
    const text2 = await res2.text();
    console.log('Centers:', res2.status, text2);
    
    // Also test users in case that's where the error is
    const res3 = await fetch('http://localhost:12011/api/v1/users?limit=1', { headers });
    const text3 = await res3.text();
    console.log('Users:', res3.status, text3);
  } catch (err) {
    console.error(err);
  }
}
test();
