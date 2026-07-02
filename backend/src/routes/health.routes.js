// src/routes/health.routes.js
import { Router } from 'express';
import { isMysqlUp, getMysql } from '../config/db.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: API health & DB status checks
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: |
 *       يرجّع حالة بسيطة للتأكد إن الـ API شغّال.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 ts:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-24T12:34:56.789Z"
 */
router.get('/', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /health/admin/status:
 *   get:
 *     summary: Detailed DB status (MySQL)
 *     description: |
 *       فحص حالة قاعدة بيانات MySQL:
 *       - اسم قاعدة البيانات الحالية.
 *       - mysqlUp توضح إذا الاتصال بـ MySQL ناجح أم لا.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: MySQL status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mysql:
 *                   type: string
 *                   nullable: true
 *                   description: اسم قاعدة بيانات MySQL لو الاتصال ناجح، أو null لو الخدمة لا تعمل
 *                   example: "etqan_main_db"
 *                 mysqlUp:
 *                   type: boolean
 *                   description: هل الاتصال بـ MySQL ناجح؟
 *                   example: true
 *                 time:
 *                   type: string
 *                   format: date-time
 *                   description: توقيت الفحص في السيرفر (ISO 8601)
 *                   example: "2025-11-24T12:34:56.789Z"
 */
router.get('/admin/status', async (req, res) => {
  const mysqlUp = await isMysqlUp();

  let mysqlName = null;
  try {
    const mysql = getMysql();
    mysqlName = mysql?.config?.database || null;
  } catch {
    mysqlName = null;
  }

  res.json({
    mysql: mysqlName,
    mysqlUp,
    time: new Date().toISOString(),
  });
});

export default router;
