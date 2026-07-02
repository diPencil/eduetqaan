
import { registerModels } from './src/models/index.js';
import { getMysql } from './src/config/db.js';

async function checkYears() {
  try {
    const { Student } = registerModels();
    const years = await Student.findAll({
      attributes: [[getMysql().fn('DISTINCT', getMysql().col('year')), 'year']],
      raw: true
    });
    console.log('Unique years in DB:', years.map(y => y.year));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkYears();
