// src/routes/admin.topups.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Topup:
 *       type: object
 *       description: طلب شحن محفظة طالب
 *       properties:
 *         id:
 *           type: integer
 *           example: 15
 *         studentId:
 *           type: integer
 *           example: 123
 *         amountCents:
 *           type: integer
 *           description: قيمة الشحن بالقرش
 *           example: 50000
 *         status:
 *           type: string
 *           description: حالة الطلب
 *           example: pending
 *         reviewNotes:
 *           type: string
 *           nullable: true
 *           example: "الصورة غير واضحة"
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         reviewedBy:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *
 *     Wallet:
 *       type: object
 *       description: محفظة طالب
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         studentId:
 *           type: integer
 *           example: 123
 *         balanceCents:
 *           type: integer
 *           description: الرصيد الحالي بالقرش
 *           example: 150000
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 */

export default function createAdminTopupsRouter(models) {
  const router = Router();
  const {
    Topup,     // ✅ MySQL only
    Wallet,
    WalletTx,
  } = models;

  // ===== عرض كل طلبات الشحن =====

  /**
   * @swagger
   * /admin/topups:
   *   get:
   *     summary: عرض آخر طلبات الشحن (بحد أقصى 100 طلب)
   *     tags: [AdminTopups]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الطلبات
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Topup'
   */
  router.get('/', requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const { status, q, method, level, centerId: queryCenterId } = req.query;

      const where = {};
      
      // 🛡️ Security Check: Center Manager can only see topups of students in their center
      if (req.user.role === 'center_manager' && req.user.centerId) {
        where['$student.centerId$'] = req.user.centerId;
      } else if (queryCenterId) {
        where['$student.centerId$'] = queryCenterId;
      }
      const { Op } = (await import('sequelize')).default;
      
      if (status && status !== 'all') {
        where.status = status;
      }
      
      if (method && method !== 'all') {
        where.method = method;
      }

      const studentInclude = {
        model: models.Student,
        as: 'student',
        attributes: ['studentName', 'studentPhone', 'year', 'centerId'],
        required: false,
        where: {}
      };

      // Robust Search logic (q)
      if (q) {
        const studentWhere = [];
        const cleanQ = String(q).trim();
        
        // Phone variation logic (similar to wallet.routes.js)
        let digits = cleanQ.replace(/[^\d]/g, '');
        let phoneVariations = [cleanQ];
        if (digits.length >= 3) {
          phoneVariations.push(digits);
          if (digits.startsWith('20')) {
            phoneVariations.push('0' + digits.substring(2));
            phoneVariations.push(digits.substring(2));
          } else if (['10', '11', '12', '15'].includes(digits.substring(0, 2))) {
            phoneVariations.push('0' + digits);
          }
        }

        const searchConditions = [
          { studentName: { [Op.like]: `%${cleanQ}%` } }
        ];
        
        for (const v of phoneVariations) {
          if (v.length >= 3) {
            searchConditions.push({ studentPhone: { [Op.like]: `%${v}%` } });
          }
        }

        studentInclude.where[Op.or] = searchConditions;
        studentInclude.required = true;
      }

      // Level / Center filters
      if (level) {
        studentInclude.where.year = level;
        studentInclude.required = true;
      }
      
      if (queryCenterId) {
        studentInclude.where.centerId = Number(queryCenterId);
        studentInclude.required = true;
      }

      // Cleanup studentInclude.where if empty to avoid Sequelize issues with empty objects in LEFT JOIN
      if (Object.keys(studentInclude.where).length === 0) {
        delete studentInclude.where;
      }

      // No filtering for staff roles
      const { count, rows } = await Topup.findAndCountAll({
        where,
        include: [studentInclude],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Ensure consistent field naming in response
      const mappedList = rows.map(item => {
        const json = item.toJSON();
        return {
          ...json,
          studentName: json.student?.studentName || '—',
          studentPhone: json.student?.studentPhone || '—',
          proofImageUrl: json.proofUrl || json.proofImageUrl || null
        };
      });

      res.json({ success: true, data: mappedList });
    } catch (e) {
      next(e);
    }
  });

  // ===== عرض تفاصيل طلب واحد =====

  /**
   * @swagger
   * /admin/topups/{id}:
   *   get:
   *     summary: عرض تفاصيل طلب شحن واحد
   *     tags: [AdminTopups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم طلب الشحن
   *     responses:
   *       200:
   *         description: تفاصيل الطلب
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Topup'
   *       404:
   *         description: الطلب غير موجود
   */
  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, message: 'id غير صالح' });
      }

      const topup = await Topup.findByPk(id);
      if (!topup) {
        return res
          .status(404)
          .json({ success: false, message: 'الطلب غير موجود' });
      }

      res.json({ success: true, data: topup });
    } catch (e) {
      next(e);
    }
  });

  // ===== الموافقة على الشحن =====

  /**
   * @swagger
   * /admin/topups/{id}/approve:
   *   post:
   *     summary: الموافقة على طلب شحن وإضافة الرصيد للمحفظة
   *     description: >
   *       يغيّر حالة الطلب من pending إلى approved، ويضيف المبلغ إلى رصيد محفظة الطالب،
   *       ويسجل حركة في جدول معاملات المحفظة.
   *     tags: [AdminTopups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم طلب الشحن
   *     responses:
   *       200:
   *         description: تمت الموافقة على الشحن وإضافة الرصيد
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "تمت الموافقة على الشحن وإضافة الرصيد بنجاح"
   *                 data:
   *                   type: object
   *                   properties:
   *                     wallet:
   *                       $ref: '#/components/schemas/Wallet'
   *                     topup:
   *                       $ref: '#/components/schemas/Topup'
   *       400:
   *         description: تمت معالجة الطلب مسبقًا أو خطأ منطقي آخر
   *       404:
   *         description: الطلب أو المحفظة غير موجود
   */
  router.post('/:id/approve', requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, message: 'id غير صالح' });
      }

      const adminId = req.user?.id || null;

      const topup = await Topup.findByPk(id);
      if (!topup) {
        return res
          .status(404)
          .json({ success: false, message: 'الطلب غير موجود' });
      }

      if (topup.status !== 'pending') {
        return res
          .status(400)
          .json({ success: false, message: 'تمت معالجته مسبقًا' });
      }

      const studentId = topup.studentId;

      const wallet = await Wallet.findOne({ where: { studentId } });
      if (!wallet) {
        return res
          .status(404)
          .json({ success: false, message: 'محفظة الطالب غير موجودة' });
      }

      const now = new Date();

      // أضف الرصيد
      wallet.balanceCents += topup.amountCents;
      wallet.updatedAtLocal = now;
      await wallet.save();

      // سجّل الحركة
      await WalletTx.create({
        walletId: wallet.id,
        type: 'credit',
        reason: 'TOPUP_APPROVED',
        amountCents: topup.amountCents,
        refType: 'TOPUP',
        refId: topup.id,
        createdAt: now,
        updatedAtLocal: now,
        meta: { 
          adminId: req.user.id,
          adminName: req.user.name || req.user.email || 'Admin'
        }
      });

      // عدّل حالة الطلب
      topup.status = 'approved';
      topup.reviewedAt = now;
      topup.reviewedBy = req.user.name || req.user.email || String(req.user.id);
      topup.updatedAtLocal = now;
      await topup.save();

      res.json({
        success: true,
        message: 'تمت الموافقة على الشحن وإضافة الرصيد بنجاح',
        data: { wallet, topup },
      });
    } catch (e) {
      next(e);
    }
  });

  // ===== رفض طلب الشحن =====

  /**
   * @swagger
   * /admin/topups/{id}/reject:
   *   post:
   *     summary: رفض طلب شحن
   *     description: يغيّر حالة الطلب من pending إلى rejected مع إمكانية إضافة سبب الرفض.
   *     tags: [AdminTopups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم طلب الشحن
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 description: سبب الرفض (اختياري)
   *                 example: "الصورة غير واضحة"
   *     responses:
   *       200:
   *         description: تم رفض الطلب
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "تم رفض الطلب"
   *                 data:
   *                   $ref: '#/components/schemas/Topup'
   *       400:
   *         description: تمت معالجة الطلب مسبقًا
   *       404:
   *         description: الطلب غير موجود
   */
  router.post('/:id/reject', requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, message: 'id غير صالح' });
      }

      const topup = await Topup.findByPk(id);
      if (!topup) {
        return res
          .status(404)
          .json({ success: false, message: 'الطلب غير موجود' });
      }

      if (topup.status !== 'pending') {
        return res
          .status(400)
          .json({ success: false, message: 'تمت معالجته مسبقًا' });
      }

      const now = new Date();

      topup.status = 'rejected';
      topup.reviewedAt = now;
      topup.reviewedBy = req.user.name || req.user.email || String(req.user.id);
      topup.updatedAtLocal = now;
      topup.reviewNotes = req.body?.reason || null;
      await topup.save();

      res.json({ success: true, message: 'تم رفض الطلب', data: topup });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
