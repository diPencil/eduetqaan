// src/models/attendance-session.model.js
import { DataTypes } from "sequelize";

/**
 * AttendanceSession:
 *  - تمثل "جلسة حضور" في السنتر لنفس المحاضرة
 *  - status: 'active' | 'closed'
 */
export function defineAttendanceSessionModel(
  sequelize,
  tableName = "attendance_sessions"
) {
  const dialect = sequelize.getDialect?.() || "sqlite";
  const isSqlite = dialect === "sqlite";
  const enumType = (values) =>
    isSqlite ? DataTypes.STRING : DataTypes.ENUM(...values);

  const AttendanceSession = sequelize.define(
    "AttendanceSession",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // السنتر الذي تُعقد فيه الجلسة
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      // المحاضرة (lesson) الخاصة بهذه الجلسة
      lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      // (اختياري) ربط بالجداول لو حابب
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // (اختياري) السنة الدراسية، لو حابب تخزنها على الجلسة
      level: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // حالة الجلسة
      status: {
        type: enumType(["active", "closed"]),
        allowNull: false,
        defaultValue: "active",
        comment: "active = جلسة مفتوحة، closed = جلسة منتهية",
      },

      // تاريخ الجلسة (يومها) – ممكن يكون نفس startedAt أو التاريخ فقط
      sessionDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // وقت بداية الجلسة فعليًا
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // وقت نهاية الجلسة (بعد الضغط على إنهاء)
      endedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // المستخدم اللي فتح الجلسة (مدرس / أدمن)
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },

      updatedAtLocal: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName,
      timestamps: false,
      indexes: [
        { fields: ["centerId"] },
        { fields: ["lessonId"] },
        { fields: ["courseId"] },
        { fields: ["status"] },
        { fields: ["sessionDate"] },
      ],
    }
  );

  return AttendanceSession;
}
