import { Sequelize } from 'sequelize';
const sqlite = new Sequelize({
  dialect: 'sqlite',
  storage: './data/local.sqlite',
  logging: true
});
async function run() {
  try {
    await sqlite.query("INSERT INTO `student_attendance` (`id`,`studentId`,`courseId`,`lessonId`,`centerId`,`accessMode`,`attendedAt`,`accessExpiresAt`,`maxViews`,`viewsUsed`,`createdAt`,`updatedAtLocal`) VALUES (NULL,1,5,2,1,'HW_ONLY','2026-06-25 18:50:00',NULL,NULL,0,'2026-06-25 18:50:00','2026-06-25 18:50:00');");
    console.log("Success!");
  } catch (err) {
    console.error(err);
  }
}
run();
