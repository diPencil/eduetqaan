import { DataTypes } from 'sequelize';

export function defineAuditLogModel(sequelize) {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userRole: {
      type: DataTypes.STRING,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'AuditLogs',
    timestamps: true
  });

  return AuditLog;
}
