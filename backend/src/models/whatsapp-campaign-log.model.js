import { DataTypes } from 'sequelize';

export function defineWhatsappCampaignLogModel(sequelize) {
  return sequelize.define('WhatsappCampaignLog', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    
    // ربط بالحملة
    campaignId: { type: DataTypes.INTEGER, allowNull: false },

    // بيانات الطالب (بنخزنها هنا عشان لو الطالب اتمسح بعدين نفضل عارفين بعتنا لمين)
    studentId: { type: DataTypes.INTEGER, allowNull: true },
    studentName: { type: DataTypes.STRING, allowNull: true },
    studentPhone: { type: DataTypes.STRING, allowNull: true },

    // الحالة
    status: { 
        type: DataTypes.ENUM('SUCCESS', 'FAILED'), 
        allowNull: false 
    },

    // سبب الفشل (لو فشل)
    errorReason: { type: DataTypes.TEXT, allowNull: true },

    createdAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'whatsapp_campaign_logs',
    timestamps: true 
  });
}