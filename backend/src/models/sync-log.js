// src/models/sync-log.js
import { DataTypes } from 'sequelize';

export function defineSyncLogModel(sequelize) {
  return sequelize.define(
    'SyncLog',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      operationId: {
        type: DataTypes.STRING(36),
        allowNull: true,
      },
      modelName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      op: {
        type: DataTypes.ENUM('create', 'update', 'delete', 'pull', 'bulk'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('SUCCESS', 'FAILED', 'WARNING'),
        allowNull: false,
        defaultValue: 'SUCCESS',
      },
      details: {
        type: DataTypes.TEXT, // Using TEXT for flexible details/error message
        allowNull: true,
      },
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'sync_logs',
      underscored: true,
      timestamps: false, // We have our own timestamp
    }
  );
}
