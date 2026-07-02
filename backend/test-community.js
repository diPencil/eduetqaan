import { Sequelize, Op, literal } from 'sequelize';
import { defineCommunityQuestionModel } from './src/models/community.question.model.js';
import { defineStudentModel } from './src/models/student.model.js';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './data/local.sqlite',
  logging: console.log
});

const CommunityQuestionModel = defineCommunityQuestionModel(sequelize);
const StudentModel = defineStudentModel(sequelize);

CommunityQuestionModel.belongsTo(StudentModel, { foreignKey: 'studentId', as: 'student' });

(async () => {
  try {
    const res = await CommunityQuestionModel.findAndCountAll({
      where: { isDeleted: false, status: 'open' },
      order: [['id', 'DESC']],
      include: [{
        model: StudentModel,
        as: 'student',
        attributes: ['id', 'studentName']
      }],
      attributes: {
        include: [
          [literal(`(SELECT COUNT(1) FROM community_answers a WHERE a.questionId = CommunityQuestion.id AND a.isDeleted = 0)`), 'answersCount']
        ]
      }
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
