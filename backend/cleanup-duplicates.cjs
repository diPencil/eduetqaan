const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize('mysql://root:@localhost:3306/Samy_db', {
  logging: false
});

async function run() {
  try {
    const [results] = await sequelize.query(`
      SELECT studentId, courseId, lessonId, COUNT(*) as c, MAX(id) as max_id
      FROM student_attendance
      GROUP BY studentId, courseId, lessonId
      HAVING c > 1
    `);
    
    for (const row of results) {
      console.log(`Deleting duplicate attendance for student ${row.studentId}, course ${row.courseId}, lesson ${row.lessonId}. Keeping id ${row.max_id}.`);
      await sequelize.query(`
        DELETE FROM student_attendance 
        WHERE studentId = ? AND courseId = ? AND lessonId = ? AND id != ?
      `, {
        replacements: [row.studentId, row.courseId, row.lessonId, row.max_id]
      });
    }
    console.log('Cleanup complete.');
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();
