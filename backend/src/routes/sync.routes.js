import express from 'express';
import { generateSqlFromOutbox } from '../utils/sql-generator.js';
import { syncOnce } from '../services/sync-worker.js';
import { pullOnce } from '../services/pull-worker.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

export function createSyncRouter(modelsMap) {
  const router = express.Router();
  const { Outbox, SyncLog } = modelsMap.__helpers;

  // All sync routes require admin or supervisor access
  router.use(requireAuth, requireRole('admin', 'supervisor'));

  // 1. الإحصائيات العامة
  router.get('/stats', async (req, res) => {
    try {
      const counts = await Outbox.findAll({
        attributes: [
          'status',
          [Outbox.sequelize.fn('COUNT', Outbox.sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      const stats = {
        PENDING: 0,
        FAILED: 0,
        COMPLETED: 0,
        totalLogs: await SyncLog.count(),
        successLogs: await SyncLog.count({ where: { status: 'SUCCESS' } }),
        failedLogs: await SyncLog.count({ where: { status: 'FAILED' } }),
      };

      counts.forEach(c => {
        stats[c.status] = c.get('count');
      });

      res.json({ success: true, stats });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 2. تقارير المزامنة (التاريخ)
  router.get('/reports', async (req, res) => {
    try {
      const { limit = 50, offset = 0, status } = req.query;
      const where = {};
      if (status) where.status = status;

      const { count, rows } = await SyncLog.findAndCountAll({
        where,
        order: [['timestamp', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      console.log(`[SyncRouter] Found ${rows ? rows.length : 0} reports out of ${count} total.`);
      res.json({ success: true, count, rows });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 3. مسح السجلات القديمة
  router.post('/reports/clear', async (req, res) => {
    try {
      await SyncLog.destroy({ where: {} });
      res.json({ success: true, message: 'Logs cleared' });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 4. قائمة العمليات المتعثرة في Outbox
  router.get('/outbox', async (req, res) => {
    try {
      const { status = 'FAILED' } = req.query;
      const rows = await Outbox.findAll({
        where: { status },
        order: [['createdAt', 'DESC']],
        limit: 100
      });
      res.json({ success: true, rows });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 5. إعادة محاولة المزامنة يدوياً
  router.post('/reprocess', async (req, res) => {
    try {
      const { id } = req.body;
      if (id) {
        const row = await Outbox.findByPk(id);
        if (row) {
          row.status = 'PENDING';
          await row.save();
        }
      } else {
        await Outbox.update({ status: 'PENDING' }, { where: { status: 'FAILED' } });
      }

      syncOnce(modelsMap);
      res.json({ success: true, message: 'Reprocess started' });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 6. تصدير SQL للتعافي اليدوي
  router.get('/export-sql', async (req, res) => {
    try {
      const { Op } = modelsMap.__helpers.Outbox.sequelize;
      const rows = await Outbox.findAll({
        where: { status: { [Op.in]: ['FAILED', 'PENDING'] } },
        order: [['createdAt', 'ASC']]
      });

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No unsynced operations to export' });
      }

      let sql = `-- Alameed Iron Sync - Unsynced Operations Export\n`;
      sql += `-- Generated at: ${new Date().toISOString()}\n\n`;
      sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      for (const row of rows) {
        sql += `-- Operation ID: ${row.operationId} | Table: ${row.modelName}\n`;
        sql += generateSqlFromOutbox(row) + '\n\n';
      }

      sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=failed_sync_recovery.sql');
      res.send(sql);
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 7. تشغيل سحب يدوي
  router.post('/pull', async (req, res) => {
    try {
      await pullOnce(modelsMap);
      res.json({ success: true, message: 'Manual pull completed' });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  return router;
}
