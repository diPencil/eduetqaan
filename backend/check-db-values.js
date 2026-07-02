import { registerModels } from './src/models/index.js';
import { getMysql } from './src/config/db.js';

async function check() {
  try {
    const { Student } = registerModels();
    const years = await Student.findAll({
      attributes: [[getMysql().fn('DISTINCT', getMysql().col('year')), 'year']],
      raw: true
    });
    console.log('--- DISTINCT YEARS ---');
    console.log(years.map(y => y.year));
    
    // Check first 5 students to see format
    const sample = await Student.findAll({ limit: 5, raw: true });
    console.log('--- SAMPLE STUDENTS ---');
    sample.forEach(s => console.log(`Name: ${s.studentName}, Year: ${s.year}`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
