const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Samy_db'
  });

  await connection.execute(`
    INSERT INTO faq_items (questionText, answerText, category, level, status, orderIndex, isDeleted, createdAtLocal, updatedAtLocal) 
    VALUES ('كيف أقوم باستعادة كلمة المرور؟', 'من خلال الضغط على نسيت كلمة المرور وسيصلك كود التفعيل.', 'عام', 'الكل', 'published', 1, 0, NOW(), NOW());
  `);

  console.log("Seeded MySQL successfully.");
  process.exit(0);
}
seed();
