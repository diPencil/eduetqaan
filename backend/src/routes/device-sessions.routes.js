// src/routes/device-sessions.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   - name: DeviceSessions
 *     description: إدارة جلسات وأجهزة الطلاب المسجّلة (متابعة الأجهزة وإلغاء الجلسات)
 *
 * components:
 *   schemas:
 *     DeviceSessionDto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *         deviceId:
 *           type: string
 *           description: معرف الجهاز (بصمة / توكن محلي)
 *         userAgent:
 *           type: string
 *         ip:
 *           type: string
 *         lastSeenAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         revokedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     DeviceSessionListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DeviceSessionDto'
 *
 *     SimpleMessageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 */

export default function createDeviceSessionsRouter(models) {
  const router = Router();
  
  // استخدام fallback لدعم الاسمين (DeviceSessionMysql أو DeviceSession)
  // بنفس الطريقة المستخدمة في students.routes.js
  const DeviceSessionModel = models.DeviceSessionMysql || models.DeviceSession;
  
  if (!DeviceSessionModel) {
    console.error('[DeviceSessions] ⚠️ DeviceSession model not found in models:', Object.keys(models));
    throw new Error('DeviceSession model is not configured');
  }

  /**
   * @swagger
   * /device-sessions:
   *   get:
   *     summary: عرض جميع أجهزة / جلسات طالب معيّن
   *     description: يسترجع قائمة الجلسات المسجّلة لجهاز/أجهزة طالب واحد حسب studentId.
   *     tags: [DeviceSessions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: studentId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الطالب المطلوب عرض أجهزته
   *     responses:
   *       200:
   *         description: قائمة جلسات الأجهزة للطالب
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeviceSessionListResponse'
   *       400:
   *         description: studentId مفقود أو غير صالح
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: صلاحيات غير كافية
   */
  // عرض أجهزة طالب معيّن
  router.get(
    '/',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const studentId = Number(req.query.studentId || 0);
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: 'studentId مطلوب' });
        }

        const rows = await DeviceSessionModel.findAll({
          where: { studentId },
          order: [['id', 'DESC']], // الأحدث أولاً
          attributes: [
            'id',
            'studentId',
            'deviceId',
            'userAgent',
            'ip',
            'lastSeenAt',
            'expiresAt',
            'revokedAt',
            'createdAtLocal',
            'updatedAtLocal',
          ],
        });

        res.json({ success: true, data: rows });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /device-sessions/{id}:
   *   delete:
   *     summary: إلغاء / مسح جلسة جهاز واحدة
   *     description: يقوم بتعليم الجلسة كـ revoked عن طريق تعيين revokedAt.
   *     tags: [DeviceSessions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الجلسة (DeviceSession.id)
   *     responses:
   *       200:
   *         description: تم إلغاء الجلسة بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SimpleMessageResponse'
   *       400:
   *         description: id غير صالح
   *       404:
   *         description: الجلسة غير موجودة
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: صلاحيات غير كافية
   */
  // مسح جهاز واحد (إلغاء جلسة)
  router.delete(
    '/:id',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: 'id غير صالح' });
        }

        const s = await DeviceSessionModel.findByPk(id);
        if (!s) {
          return res
            .status(404)
            .json({ success: false, message: 'الجلسة غير موجودة' });
        }

        s.revokedAt = new Date();
        s.updatedAtLocal = new Date();
        await s.save();

        res.json({ success: true, message: 'تم إلغاء الجلسة' });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /device-sessions/by-student/{studentId}:
   *   delete:
   *     summary: إلغاء جميع الجلسات لأحد الطلاب
   *     description: يضع revokedAt لكل الجلسات الخاصة بالطالب المحدّد.
   *     tags: [DeviceSessions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: studentId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الطالب المطلوب إلغاء جميع جلساته
   *     responses:
   *       200:
   *         description: تم إلغاء جميع الجلسات للطالب
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SimpleMessageResponse'
   *       400:
   *         description: studentId غير صالح
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: صلاحيات غير كافية
   */
  // مسح كل أجهزة طالب (إلغاء جميع الجلسات)
  router.delete(
    '/by-student/:studentId',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const studentId = Number(req.params.studentId);
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: 'studentId غير صالح' });
        }

        // Bulk Update for better performance
        const [updatedCount] = await DeviceSessionModel.update(
          { 
            revokedAt: new Date(), 
            updatedAtLocal: new Date() 
          },
          {
            where: {
              studentId,
              revokedAt: null // Only revoke active sessions
            }
          }
        );
        
        res.json({
          success: true,
          message: `تم إلغاء ${updatedCount} جلسة لهذا الطالب`,
          revokedCount: updatedCount,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
