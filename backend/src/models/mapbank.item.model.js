// src/models/map-bank-item.model.js
import { DataTypes } from 'sequelize';

export function defineMapBankItemModel(
  sequelize,
  tableName = 'map_bank_items'
) {
  const MapBankItem = sequelize.define(
    'MapBankItem',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      bankId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      // رقم الماركر على الخريطة (1, 2, 3, ..)
      markerNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      // نص السؤال
      prompt: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      // إجابة نصية (اختياري)
      answerText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Array<string> – اختيارية
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      // draft | published
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'draft',
      },

      // ترتيب الظهور داخل البنك
      orderIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      // حذف ناعم
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      createdAtLocal: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },

      updatedAtLocal: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName,
      timestamps: false,
      indexes: [
        { fields: ['bankId'] },
        { fields: ['status'] },
        { fields: ['orderIndex'] },
        { fields: ['markerNumber'] },
      ],
    }
  );

  return MapBankItem;
}
