import { DataTypes } from 'sequelize';

export function defineWhatsappCampaignModel(sequelize) {
  return sequelize.define('WhatsappCampaign', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    
    // عنوان الحملة
    title: { type: DataTypes.STRING, allowNull: true },
    
    // نص الرسالة
    messageTemplate: { type: DataTypes.TEXT, allowNull: false },
    
    // === التحديثات الجديدة ===
    
    // نوع الاستهداف (فلتر عادي، حضور، أكواد يدوية)
    targetType: { 
        type: DataTypes.ENUM('FILTERS', 'ATTENDANCE', 'SPECIFIC_CODES'), 
        allowNull: false,
        defaultValue: 'FILTERS'
    },

    // تفاصيل الاستهداف (هنخزن هنا أي داتا زيادة زي IDs للمحاضرات أو الفلاتر)
    targetDetails: { type: DataTypes.JSON, allowNull: true },

    // إعدادات التحكم في السرعة (Throttling)
    batchSize: { type: DataTypes.INTEGER, defaultValue: 5 }, // ابعت لكام واحد في المرة
    batchDelay: { type: DataTypes.INTEGER, defaultValue: 10 }, // استنى كام ثانية

    // ========================

    // الإحصائيات
    totalTargeted: { type: DataTypes.INTEGER, defaultValue: 0 },
    successCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    failedCount: { type: DataTypes.INTEGER, defaultValue: 0 },

    // الحالة
    status: { 
        type: DataTypes.ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED'), 
        defaultValue: 'PENDING' 
    },

    triggeredBy: { type: DataTypes.INTEGER, allowNull: true },
    createdAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'whatsapp_campaigns',
    timestamps: true 
  });
}