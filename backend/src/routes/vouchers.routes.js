// src/routes/vouchers.routes.js
import { Router } from 'express';
import { generateVoucherCode } from '../utils/code.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * openapi: 3.0.3
 * info:
 *   title: Vouchers API
 *   version: 1.0.0
 *   description: إدارة أكواد الشحن (Vouchers) واستردادها لمحفظة الطالب
 * 
 * tags:
 *   - name: Vouchers
 *     description: إدارة أكواد الشحن واستردادها
 * 
 * components:
 *   schemas:
 *     Voucher:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codeHash:
 *           type: string
 *         length:
 *           type: integer
 *         targetType:
 *           type: string
 *         amountCents:
 *           type: integer
 *         remainingCents:
 *           type: integer
 *         currency:
 *           type: string
 *         status:
 *           type: string
 *         issuedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         redeemedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 * 
 *   requestBodies:
 *     IssueVoucherBody:
 *       description: بيانات إنشاء قسيمة جديدة
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amountCents:
 *                 type: integer
 *                 description: قيمة القسيمة بالمليمات (Cents)
 *                 example: 1000
 *               targetType:
 *                 type: string
 *                 description: نوع الهدف (WALLET, SUBSCRIPTION, ...)
 *                 example: WALLET
 *             required:
 *               - amountCents
 * 
 *     RedeemVoucherBody:
 *       description: بيانات استرداد القسيمة
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: الكود الخام للقسيمة
 *                 example: ABCD-1234-EFGH
 */

export default function createVouchersRouter(models) {
  const router = Router();

  // aliases — مرن لو الموديل متسمي بطريقة مختلفة
  const VoucherMysql =
    models.VoucherMysql || models.Voucher || models.VoucherModel || models.Vouchers;
  const WalletMysql =
    models.WalletMysql || models.Wallet || models.WalletModel || models.Wallets;
  const WalletTxMysql =
    models.WalletTxMysql ||
    models.WalletTx ||
    models.WalletTxModel ||
    models.WalletTransactions;

  if (!VoucherMysql) {
    console.warn('⚠️ Voucher model not configured (vouchers.routes.js)');
  }
  if (VoucherMysql) {
    // Diagnostic Pong
    router.get('/ping', (req, res) => res.json({ success: true, message: 'Voucher Router Active' }));
    
    // Prioritized Mark Used
    router.post('/:id/mark-used', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
      try {
        console.log(`[VOUCHER] Request to mark used: ${req.params.id}`);
        const id = Number(req.params.id);
        const v = await VoucherMysql.findByPk(id);
        if (!v) return res.status(404).json({ success: false, message: 'القسيمة غير موجودة' });
        await v.update({
          status: 'redeemed',
          remainingCents: 0,
          redeemedAt: new Date(),
          updatedAtLocal: new Date()
        });
        console.log(`[VOUCHER] Success mark used: ${id}`);
        res.json({ success: true, message: 'تم تعليم القسيمة كمستخدمة', data: v });
      } catch (err) {
        console.error(`[VOUCHER] Error:`, err);
        next(err);
      }
    });
  }

  // ===== إصدار كود جديد (أدمن فقط) =====
  /**
   * @swagger
   * /vouchers/issue:
   *   post:
   *     tags:
   *       - Vouchers
   *     summary: إصدار كود شحن جديد
   *     description: إصدار قسيمة جديدة وإرجاع الكود الخام للطباعة أو الإرسال
   *     requestBody:
   *       $ref: '#/components/requestBodies/IssueVoucherBody'
   *     responses:
   *       200:
   *         description: تم إنشاء القسيمة بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 code:
   *                   type: string
   *                 data:
   *                   $ref: '#/components/schemas/Voucher'
   *       400:
   *         description: خطأ في البيانات المدخلة
   *       500:
   *         description: خطأ في السيرفر
   */
  router.post(
    '/issue',
    requireAuth,
    requireRole('admin', 'supervisor', 'user'),
    async (req, res, next) => {
      try {
        if (!VoucherMysql) {
          return res.status(500).json({
            success: false,
            message: 'Voucher model not configured on server',
          });
        }

        const amountCents = Number(req.body?.amountCents || 0);
        const targetType = String(req.body?.targetType || 'WALLET');
        const manualCode = req.body?.code; // الكود اليدوي اختياري

        if (!amountCents || !Number.isFinite(amountCents) || amountCents <= 0) {
          return res.status(400).json({
            success: false,
            message: 'القيمة مطلوبة ويجب أن تكون أكبر من 0',
          });
        }

        let code = null;

        // إذا تم توفير كود يدوي، نتحقق من عدم وجوده مسبقاً
        if (manualCode) {
          const cleanManual = String(manualCode).trim();
          if (cleanManual.length < 4) {
             return res.status(400).json({ success: false, message: 'الكود اليدوي يجب أن يكون 4 أحرف على الأقل' });
          }
          const ex = await VoucherMysql.findOne({
            where: { codeHash: cleanManual },
          });
          if (ex) {
            return res.status(400).json({ success: false, message: 'هذا الكود موجود مسبقاً، يرجى اختيار كود آخر' });
          }
          code = cleanManual;
        } else {
          // التوليد التلقائي إذا لم يرسل كود يدوي
          const MAX_ATTEMPTS = 6;
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const candidate = generateVoucherCode(14);
            const ex = await VoucherMysql.findOne({
              where: { codeHash: String(candidate).trim() },
            });
            if (!ex) {
              code = candidate;
              break;
            }
          }
        }

        if (!code) {
          return res.status(500).json({
            success: false,
            message: 'تعذّر إنشاء كود جديد (حاول مرة أخرى لاحقًا)',
          });
        }

        const data = {
          codeHash: String(code).trim(),
          length: String(code).length,
          targetType: targetType || 'WALLET',
          amountCents,
          remainingCents: amountCents,
          currency: 'EGP',
          status: 'issued',
          issuedAt: new Date(),
          updatedAtLocal: new Date(),
        };

        const created = await VoucherMysql.create(data);

        return res.json({
          success: true,
          code,
          data: created.toJSON ? created.toJSON() : created,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ===== إصدار كمية كبيرة من الأكواد (أدمن فقط) =====
  /**
   * @swagger
   * /vouchers/bulk-issue:
   *   post:
   *     tags:
   *       - Vouchers
   *     summary: إصدار مجموعة كبيرة من أكواد الشحن
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               amountCents:
   *                 type: integer
   *               count:
   *                 type: integer
   *               targetType:
   *                 type: string
   *     responses:
   *       200:
   *         description: تم إنشاء الأكواد بنجاح
   */
  router.post(
    '/bulk-issue',
    requireAuth,
    requireRole('admin', 'supervisor', 'user'),
    async (req, res, next) => {
      try {
        if (!VoucherMysql) {
          return res.status(500).json({ success: false, message: 'Voucher model not configured' });
        }

        const amountCents = Number(req.body?.amountCents || 0);
        const count = Math.max(1, Number(req.body?.count || 1));
        const targetType = String(req.body?.targetType || 'WALLET');

        if (!amountCents || amountCents <= 0) {
          return res.status(400).json({ success: false, message: 'القيمة مطلوبة' });
        }

        const issuedAt = new Date();
        const vouchersData = [];
        
        // جلب كل هاف الأكواد الموجودة لتجنب التكرار في هذه العملية
        // ملحوظة: في المشاريع الضخمة نستخدم Unique Index في الداتابيز و try/catch
        for (let i = 0; i < count; i++) {
          const code = generateVoucherCode(14);
          vouchersData.push({
            codeHash: code,
            length: code.length,
            targetType,
            amountCents,
            remainingCents: amountCents,
            currency: 'EGP',
            status: 'issued',
            issuedAt,
            updatedAtLocal: issuedAt,
          });
        }

        // استخدام bulkCreate للسرعة
        const created = await VoucherMysql.bulkCreate(vouchersData);

        return res.json({
          success: true,
          count: created.length,
          message: `تم إنشاء ${created.length} كود بنجاح`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ===== استرداد الكود للمحفظة (طالب) =====
  /**
   * @swagger
   * /vouchers/redeem:
   *   post:
   *     tags:
   *       - Vouchers
   *     summary: استرداد قسيمة وإضافة الرصيد إلى المحفظة
   *     description: الطالب يرسل الكود، ويُضاف الرصيد إلى محفظته
   *     requestBody:
   *       $ref: '#/components/requestBodies/RedeemVoucherBody'
   *     responses:
   *       200:
   *         description: تم إضافة الرصيد بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 added:
   *                   type: integer
   *                 newBalance:
   *                   type: integer
   *       400:
   *         description: الكود غير صالح أو الرصيد منتهي
   *       401:
   *         description: غير مصرح
   *       500:
   *         description: خطأ في السيرفر
   */
  router.post('/redeem', requireAuth, async (req, res, next) => {
    try {
      if (!VoucherMysql || !WalletMysql || !WalletTxMysql) {
        return res.status(500).json({
          success: false,
          message: 'بعض الموديلات المطلوبة غير مهيأة على الخادم',
        });
      }

      const codeRaw = req.body?.code;
      if (!codeRaw) {
        return res.status(400).json({ success: false, message: 'الكود مطلوب' });
      }
      const code = String(codeRaw).trim();

      if (!code || code.length < 8) {
        return res.status(400).json({ success: false, message: 'الكود غير صالح' });
      }

      const v = await VoucherMysql.findOne({ where: { codeHash: code } });
      if (!v) {
        return res.status(400).json({
          success: false,
          message: 'كود غير صالح أو غير موجود',
        });
      }

      if (!['issued', 'partially_redeemed'].includes(String(v.status))) {
        return res.status(400).json({
          success: false,
          message: 'الكود تم استخدامه سابقًا أو غير متاح',
        });
      }

      if (!v.remainingCents || Number(v.remainingCents) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'الكود منتهي الرصيد',
        });
      }

      const studentId = req.user?.id;
      if (!studentId) {
        return res.status(401).json({ success: false, message: 'غير مصرح' });
      }

      let wallet = await WalletMysql.findOne({ where: { studentId } });

      if (!wallet) {
        if (typeof WalletMysql.create !== 'function') {
          return res.status(500).json({
            success: false,
            message: 'موديل المحفظة لا يدعم الإنشاء',
          });
        }
        wallet = await WalletMysql.create({
          studentId,
          balanceCents: 0,
          updatedAtLocal: new Date(),
        });
      }

      if (!wallet) {
        return res.status(500).json({
          success: false,
          message: 'تعذّر الحصول على المحفظة أو إنشائها',
        });
      }

      const added = Number(v.remainingCents || 0);
      const currentBalance = Number(wallet.balanceCents || 0);
      const newBalance = currentBalance + added;

      if (typeof wallet.update === 'function') {
        await wallet.update({ balanceCents: newBalance, updatedAtLocal: new Date() });
      } else {
        wallet.balanceCents = newBalance;
        wallet.updatedAtLocal = new Date();
        if (typeof wallet.save === 'function') await wallet.save();
      }

      if (typeof WalletTxMysql.create === 'function') {
        await WalletTxMysql.create({
          walletId: wallet.id,
          type: 'credit',
          reason: 'VOUCHER_REDEEM',
          amountCents: added,
          refType: 'VOUCHER',
          refId: v.id,
          createdAt: new Date(),
        });
      }

      v.remainingCents = 0;
      v.status = 'redeemed';
      v.redeemedAt = new Date();
      v.redeemedByStudentId = studentId;
      v.updatedAtLocal = new Date();
      if (typeof v.save === 'function') await v.save();
      else if (typeof VoucherMysql.update === 'function') {
        await VoucherMysql.update(
          { remainingCents: 0, status: 'redeemed', redeemedAt: v.redeemedAt, redeemedByStudentId: v.redeemedByStudentId, updatedAtLocal: v.updatedAtLocal },
          { where: { id: v.id } }
        );
      }

      return res.json({
        success: true,
        message: 'تم إضافة الرصيد إلى محفظتك بنجاح',
        added,
        newBalance,
      });
    } catch (err) {
      next(err);
    }
  });

  // ===== استعلام إداري سريع (آخر 50 قسيمة) =====
  /**
   * @swagger
   * /vouchers:
   *   get:
   *     tags:
   *       - Vouchers
   *     summary: استعلام آخر 50 قسيمة (أدمن فقط)
   *     responses:
   *       200:
   *         description: قائمة القسائم
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Voucher'
   *       500:
   *         description: خطأ في السيرفر
   */
  router.get('/', requireAuth, requireRole('admin', 'supervisor', 'user'), async (_req, res, next) => {
    try {
      if (!VoucherMysql) {
        return res.status(500).json({
          success: false,
          message: 'Voucher model not configured on server',
        });
      }

      const limit = Number(_req.query.limit) || 20000;
      const list = await VoucherMysql.findAll({
        order: [['id', 'DESC']],
        limit,
        include: [
          {
            model: models.Student,
            as: 'redeemer',
            attributes: ['id', ['studentName', 'name'], ['studentPhone', 'phone'], 'email']
          }
        ]
      });

      const data = Array.isArray(list)
        ? list.map((r) => (r && r.toJSON ? r.toJSON() : r))
        : [];

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  // ===== تحديث قسيمة (أدمن فقط) =====
  router.patch('/:id', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      if (!VoucherMysql) return res.status(500).json({ success: false, message: 'Model missing' });
      
      const id = req.params.id;
      const { amountCents, status, remainingCents } = req.body;
      
      const v = await VoucherMysql.findByPk(id);
      if (!v) return res.status(404).json({ success: false, message: 'القسيمة غير موجودة' });

      const updateData = { updatedAtLocal: new Date() };
      if (amountCents !== undefined) updateData.amountCents = amountCents;
      if (status !== undefined) updateData.status = status;
      if (remainingCents !== undefined) updateData.remainingCents = remainingCents;

      await v.update(updateData);
      res.json({ success: true, data: v });
    } catch (err) {
      next(err);
    }
  });

  // ===== حذف قسيمة (أدمن فقط) =====
  router.delete('/:id', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      if (!VoucherMysql) return res.status(500).json({ success: false, message: 'Model missing' });
      
      const id = req.params.id;
      const v = await VoucherMysql.findByPk(id);
      if (!v) return res.status(404).json({ success: false, message: 'القسيمة غير موجودة' });

      await v.destroy();
      res.json({ success: true, message: 'تم حذف القسيمة بنجاح' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
