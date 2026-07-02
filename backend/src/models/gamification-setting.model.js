// src/models/gamification-setting.model.js
import { DataTypes } from 'sequelize';

export function defineGamificationSettingModel(sequelize) {
  return sequelize.define('GamificationSetting', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    
    pointsPerEgp: { type: DataTypes.FLOAT, defaultValue: 0.1 }, 
    pointsForFullMark: { type: DataTypes.INTEGER, defaultValue: 50 },
    pointsForVideoComplete: { type: DataTypes.INTEGER, defaultValue: 10 },
    pointsForAttendance: { type: DataTypes.INTEGER, defaultValue: 5 },
    
    pointToEgpRatio: { type: DataTypes.FLOAT, defaultValue: 0.5 }, // e.g. 1 point = 0.5 EGP
    
    updatedAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'gamification_settings',
    timestamps: false
  });
}
