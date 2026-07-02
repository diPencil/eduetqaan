import { DataTypes } from 'sequelize';

export function defineUserModel(sequelize, tableName = 'users') {
  return sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    email:        { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },

    // اسم يظهر في الداشبورد والإجابات (اختياري)
    name:  { type: DataTypes.STRING, allowNull: true },

    // admin | supervisor | center_manager | support
    role: { 
      type: DataTypes.ENUM('admin', 'supervisor', 'center_manager', 'support'), 
      allowNull: false, 
      defaultValue: 'support' 
    },

    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    centerId: { type: DataTypes.INTEGER, allowNull: true }, // ⚡ NEW: لربط المدرس بسنتر معين

    createdAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName,
    timestamps: false,
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['role'] },
    ],
  });
}
