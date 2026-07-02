// src/middlewares/auth.js
import jwt from 'jsonwebtoken';

import { getMysql } from '../config/db.js';

let DeviceSessionModel = null;

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, code: 'NO_TOKEN', message: 'Unauthorized' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('[Security] JWT_SECRET is not defined in environment variables!');
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, level, iat, exp }

    // --- CHECK DEVICE SESSION ---
    if (req.user?.role === 'student') {
      const deviceId = String(req.headers['x-device-id'] || '').trim();
      if (deviceId) {
        try {
          if (!DeviceSessionModel) {
            const sequelize = getMysql();
            if (sequelize) {
              DeviceSessionModel = sequelize.models.DeviceSession;
            }
          }
          if (DeviceSessionModel) {
            const session = await DeviceSessionModel.findOne({
              where: { studentId: req.user.id, deviceId }
            });
            if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
              return res.status(401).json({
                success: false,
                code: 'SESSION_REVOKED',
                message: 'تم تسجيل الخروج من هذا الجهاز أو تم مسح جلستك'
              });
            }
          }
        } catch (dbErr) {
          console.error('[Auth] Error checking device session:', dbErr);
        }
      }
    }
    // -----------------------------

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      });
    }

    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Invalid token',
    });
  }
}
