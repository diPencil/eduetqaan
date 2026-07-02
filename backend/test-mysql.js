import { Sequelize } from 'sequelize';
const sequelize = new Sequelize('Samy_db', 'root', '', { host: 'localhost', port: 3306, dialect: 'mysql' });
async function run() {
  const courses = await sequelize.query("SELECT id, title, level FROM courses LIMIT 10", { type: Sequelize.QueryTypes.SELECT });
  console.log(courses);
  process.exit(0);
}
run();
