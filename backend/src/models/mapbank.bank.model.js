// src/models/map-bank.model.js
import { DataTypes } from 'sequelize';

export function defineMapBankModel(sequelize, tableName = 'map_banks') {
  const MapBank = sequelize.define(
    'MapBank',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      // عنوان البنك (مثلاً: خريطة الوطن العربي)
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // كود المرحلة/السنة (prep3, sec3, 3sec ...)
      level: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // صورة الخريطة الأساسية للبنك
      mapImageUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // draft | published
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'draft',
      },

      // ترتيب الظهور
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
        { fields: ['level'] },
        { fields: ['status'] },
        { fields: ['orderIndex'] },
      ],
    }
  );

  return MapBank;
}
