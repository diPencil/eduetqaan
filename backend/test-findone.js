import { models } from './src/models/index.js';
import { Op } from 'sequelize';

async function run() {
  const sessionDate = '2026-06-25';
  const startOfDay = new Date(sessionDate + 'T00:00:00.000Z');
  const endOfDay = new Date(sessionDate + 'T23:59:59.999Z');
  const studentId = 1;
  const courseId = 5;
  const lessonId = 3;
  const centerId = 1;
  
  const existing = await models.StudentAttendance.findOne({
    where: {
      studentId,
      courseId,
      lessonId,
      centerId,
      attendedAt: {
        [Op.gte]: startOfDay,
        [Op.lte]: endOfDay,
      },
    },
    order: [['id', 'DESC']],
  });
  console.log("existing:", existing ? existing.toJSON() : null);
}
run();
