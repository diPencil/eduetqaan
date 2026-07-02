// src/models/lesson-exam-score.model.js
import { DataTypes } from "sequelize";

export function defineLessonExamScoreModel(
  sequelize,
  tableName = "lesson_exam_scores"
) {
  return sequelize.define(
    "LessonExamScore",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      studentId: { type: DataTypes.INTEGER, allowNull: false },
      centerId: { type: DataTypes.INTEGER, allowNull: false },
      courseId: { type: DataTypes.INTEGER, allowNull: false },
      lessonId: { type: DataTypes.INTEGER, allowNull: false },

      // درجة الطالب في الامتحان
      score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

      // الدرجة الكلية للامتحان (مثلاً من 20 أو من 30)
      maxScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

      // لو الطالب غايب عن الامتحان نفسه (غير غياب المحاضرة)
      isAbsent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // تاريخ الامتحان (اختياري – default now)
      examDate: { type: DataTypes.DATE, allowNull: true },

      note: { type: DataTypes.STRING, allowNull: true },

      createdAtLocal: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAtLocal: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName,
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["studentId", "centerId", "courseId", "lessonId"],
        },
        { fields: ["centerId"] },
        { fields: ["courseId"] },
        { fields: ["lessonId"] },
      ],
    }
  );
}
