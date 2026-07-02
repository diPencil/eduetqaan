// src/models/point-transaction.model.js
import { DataTypes } from 'sequelize';

export function definePointTransactionModel(sequelize) {
  return sequelize.define('PointTransaction', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: false },
    createdAtLocal: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'point_transactions',
    timestamps: false,
    indexes: [
      { fields: ['studentId'] }
    ]
  });
}
