// src/models/student-attendance.model.js
import { DataTypes } from 'sequelize';

export function defineStudentAttendanceModel(
  sequelize,
  tableName = 'student_attendance'
) {
  const dialect = sequelize.getDialect?.() || 'sqlite';
  const isSqlite = dialect === 'sqlite';
  const enumType = (values) =>
    isSqlite ? DataTypes.STRING : DataTypes.ENUM(...values);

  return sequelize.define(
    'StudentAttendance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // الطالب / الكورس / المحاضرة
      studentId: { type: DataTypes.INTEGER, allowNull: false },
      courseId: { type: DataTypes.INTEGER, allowNull: false },
      lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'المحاضرة الأصلية (kind = lesson)',
      },

      // السنتر الذي تم تسجيل الحضور عليه (null لو أونلاين فقط)
      centerId: { type: DataTypes.INTEGER, allowNull: true },

      // جلسة الحضور في السنتر (slot واحد) – null لو مش مربوط بجلسة
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment:
          'ID لجلسة الحضور في السنتر (attendance_sessions.id) لو الحضور كان داخل حصة سنتر',
      },

      // نوع الوصول للمحتوى بعد تسجيل الحضور
      accessMode: {
        type: enumType(['HW_ONLY', 'FULL_LESSON']),
        allowNull: false,
        defaultValue: 'HW_ONLY',
        comment:
          'HW_ONLY = افتح الواجب فقط, FULL_LESSON = افتح المحاضرة + الواجب',
      },

      // وقت تسجيل الحضور / فتح الوصول
      attendedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

      // المستخدم الذي سجّل الحضور (لو من لوحة الكنترول)
      recordedByUserId: { type: DataTypes.INTEGER, allowNull: true },

      // حدود الوصول
      accessExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true, // ينتهي بعد X أيام
      },
      maxViews: {
        type: DataTypes.INTEGER,
        allowNull: true, // أقصى عدد مشاهدات
      },
      viewsUsed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // كام مشاهدة استهلك
      },

      // === NEW: ملاحظة الحضور ===
      note: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ملاحظة إدارية عند تسجيل الحضور',
      },

      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updatedAtLocal: { type: DataTypes.DATE },
    },
    {
      tableName,
      timestamps: false,
      indexes: [
        { fields: ['studentId'] },
        { fields: ['lessonId'] },
        { fields: ['courseId'] },
        { fields: ['accessMode'] },
        { fields: ['centerId'] },
        { fields: ['sessionId'] },
        { fields: ['accessExpiresAt'] },
      ],
    }
  );
}