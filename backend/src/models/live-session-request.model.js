// src/models/live-session-request.model.js
import { DataTypes } from 'sequelize';

export function defineLiveSessionRequestModel(
  sequelize,
  tableName = 'live_session_requests'
) {
  return sequelize.define(
    'LiveSessionRequest',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      // لو الطالب مسجل دخول أو لقيناه برقم الموبايل
      studentId: { type: DataTypes.INTEGER, allowNull: true },

      // الاسم ورقم الواتساب اللي كتبهم في الفورم
      name: { type: DataTypes.STRING, allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: false },

      // مصدر الطلب
      source: {
        type: DataTypes.ENUM('site', 'whatsapp', 'call'),
        allowNull: false,
        defaultValue: 'site',
      },

      // حالة الطلب
      status: {
        type: DataTypes.ENUM('new', 'contacted', 'ignored'),
        allowNull: false,
        defaultValue: 'new',
      },

      // لو تحدد معاد للجلسة
      scheduledAt: { type: DataTypes.DATE, allowNull: true },

      // ملاحظات من الدعم/الأدمن
      notes: { type: DataTypes.TEXT, allowNull: true },

      // رابط الاجتماع (Google Meet, Zoom, etc)
      meetLink: { type: DataTypes.STRING(500), allowNull: true },

      // وقت إرسال النوتيفكيشن (لو استخدمته بعدين)
      notifiedAt: { type: DataTypes.DATE, allowNull: true },

      // mirror
      createdAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updatedAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      tableName,
      timestamps: false,
      indexes: [
        { fields: ['studentId'] },
        { fields: ['phone'] },
        { fields: ['status'] },
      ],
    }
  );
}
