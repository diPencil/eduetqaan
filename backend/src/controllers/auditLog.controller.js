import { Op } from 'sequelize';

export const getAuditLogs = (models) => async (req, res) => {
  try {
    const { page = 1, limit = 15, action, entityType, searchTerm } = req.query;
    const AuditLog = models.AuditLog || models.AuditLogMysql || models.AuditLogSqlite;
    
    if (!AuditLog) {
      return res.status(500).json({ success: false, message: 'AuditLog model not found' });
    }
    
    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (searchTerm) {
      where.details = { [Op.like]: `%${searchTerm}%` };
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: rows,
      total: count,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createAuditLog = (models) => async (req, res) => {
  try {
    const { userId, userName, userRole, action, entityType, entityId, entityName, details } = req.body;
    const AuditLog = models.AuditLog || models.AuditLogMysql || models.AuditLogSqlite;
    
    if (!AuditLog) {
      return res.status(500).json({ success: false, message: 'AuditLog model not found' });
    }
    
    // Usually the user would be pulled from req.user
    const log = await AuditLog.create({
      userId: userId || (req.user ? req.user.id : null),
      userName: userName || (req.user ? req.user.name : 'System'),
      userRole: userRole || (req.user ? req.user.role : 'admin'),
      action,
      entityType,
      entityId,
      entityName,
      details
    });

    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error('createAuditLog error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
