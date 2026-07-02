const http = require('http');

const data = JSON.stringify({
  title: "Test Course",
  slug: "test-course-" + Date.now(),
  level: "الاول الثانوي",
  priceCents: 1000,
  status: "published"
});

const options = {
  hostname: 'localhost',
  port: 12011,
  path: '/api/v1/courses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // Bypass auth or use a valid JWT. Wait, auth is required.
    // I can try to bypass it if I connect to the DB and get the token.
  }
};

// I'll execute a direct DB insert instead if I just want to see validation.
// No, the validation is in the Express router.
