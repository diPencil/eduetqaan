import { DataTypes } from 'sequelize';

export function defineExamQuestionModel(sequelize, tableName = 'exam_questions') {
  const ExamQuestion = sequelize.define('ExamQuestion', {
    id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    examId:     { type: DataTypes.INTEGER, allowNull: false },

    // ملاحظة: نخليها allowNull:false زي ما هي عشان ما نكسرش DB constraint
    // والراوت عندنا بيبعت "" لو السؤال صورة فقط.
    text:       { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },

    imageUrl:   { type: DataTypes.STRING(1000) },

    // choices كـ JSON: [{ id: 'a', text: '...' }, ...]
    choicesJson:{ type: DataTypes.TEXT, allowNull: false },

    // answer = choice.id الصحيحة
    answer:     { type: DataTypes.STRING(64), allowNull: false },

    // ✅ جديد: تبرير/شرح الإجابة الصحيحة (عام)
    explanation: { type: DataTypes.TEXT, allowNull: true },

    // ✅ جديد: تبرير لكل اختيار (اختياري)
    // مثال: { "a": "ليه غلط", "b": "ليه صح", ... }
    explanationsJson: { type: DataTypes.TEXT, allowNull: true },

    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName,
    timestamps: false,
    indexes: [{ fields: ['examId'] }, { fields: ['orderIndex'] }],
  });

  return ExamQuestion;
}
export default defineExamQuestionModel;
