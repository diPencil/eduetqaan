import { registerModels } from './src/models/index.js';

async function run() {
  try {
    const { Student } = registerModels();
    const s = await Student.findOne({
      where: {
        studentPhone: '01027052213'
      },
      raw: true
    });
    console.log('Student with 01027052213:', s ? s.studentName : 'NOT FOUND');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
