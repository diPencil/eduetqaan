import { Router } from 'express';
import { getAuditLogs, createAuditLog } from '../controllers/auditLog.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

export default function createAuditLogRouter(models) {
  const router = Router();
  // We use requireAuth + requireRole('admin') instead of requireAdmin
  router.get('/', requireAuth, requireRole('admin'), getAuditLogs(models));
  router.post('/', requireAuth, requireRole('admin'), createAuditLog(models));
  return router;
}
