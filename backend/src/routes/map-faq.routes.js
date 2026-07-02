// src/routes/map-faq.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import multer from 'multer';
import { isAllowedHost } from '../utils/url-guard.js';
import { requireAuth } from '../middlewares/auth.js';
import softAuth from '../middlewares/soft-auth.js';
import { requireRole } from '../middlewares/roles.js';
import { normalizeLevel } from '../utils/levels.js';
import { decodeId, encodeId } from "../utils/hash.js";
import { uploadFileToStorage } from '../lib/upload-storage.js';

/**
 * @swagger
 * tags:
 *   name: MapFAQ
 *   description: إدارة بنوك الخرائط التعليمية (بنك = خريطة واحدة + نقاط مرقّمة وأسئلة عليها).
 *
 * components:
 *   schemas:
 *     MapBank:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *           description: عنوان البنك (مثلاً "خريطة الوطن العربي").
 *         level:
 *           type: string
 *           description: المرحلة أو السنة (مثلاً prep3, sec3...).
 *         mapImageUrl:
 *           type: string
 *           description: رابط صورة الخريطة الأساسية لهذا البنك.
 *         status:
 *           type: string
 *           description: حالة البنك (مثلاً draft أو published).
 *         orderIndex:
 *           type: integer
 *           description: ترتيب الظهور في القائمة.
 *         isDeleted:
 *           type: boolean
 *           description: حذف ناعم (soft delete).
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     MapBankItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         bankId:
 *           type: integer
 *         markerNumber:
 *           type: integer
 *           description: رقم العنصر على الخريطة (1, 2, 3 ...).
 *         prompt:
 *           type: string
 *           description: نص السؤال المرتبط بالرقم على الخريطة.
 *         answerText:
 *           type: string
 *           nullable: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *           description: وسوم تساعد في الفلترة والبحث (اختياري).
 *         status:
 *           type: string
 *           description: حالة العنصر (draft | published).
 *         orderIndex:
 *           type: integer
 *         isDeleted:
 *           type: boolean
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

function validUrlMaybe(u) {
  if (!u) return true;
  return isAllowedHost(String(u));
}

function normalizeTags(arr) {
  if (!arr) return null;
  if (!Array.isArray(arr)) return null;
  const t = arr
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return t.length ? t : null;
}

// Multer لرفع صورة الخريطة (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      Number(process.env.COMMUNITY_MAX_UPLOAD_MB || 20) * 1024 * 1024,
  },
});

export default function createMapFaqRouter(models) {
  const router = Router();

  // Aliases مرنة عشان تشتغل مع SQLite أو MySQL
  const MapBankMysql =
    models.MapBankMysql || models.MapBank || models.MapBankModel;
  const MapBankItemMysql =
    models.MapBankItemMysql ||
    models.MapBankItem ||
    models.MapBankItemModel;

  function ensureBankModel(res) {
    if (!MapBankMysql) {
      res
        .status(500)
        .json({
          success: false,
          error: 'MapBank model not configured on server',
        });
      return false;
    }
    return true;
  }

  function ensureItemModel(res) {
    if (!MapBankItemMysql) {
      res
        .status(500)
        .json({
          success: false,
          error: 'MapBankItem model not configured on server',
        });
      return false;
    }
    return true;
  }

  async function uploadMapImageFromRequest(file, level, labelRaw) {
    if (!file) return null;

    const levelSlug = String(level || 'general').trim() || 'general';

    const labelClean =
      String(labelRaw || 'map')
        .toLowerCase()
        .replace(/[^a-z0-9\-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'map';

    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
        ? 'webp'
        : file.mimetype === 'image/jpeg'
        ? 'jpg'
        : 'bin';

    const ts = Date.now();

    // مثال لمسار منظم داخل R2: geo/maps/sec3/arab-world-1712345678.png
    const key = `geo/maps/${levelSlug}/${labelClean}-${ts}.${ext}`;

    const result = await uploadFileToStorage(
      file.buffer,
      key,
      file.mimetype
    );

    return result; // { driver, key, url }
  }

  // ===================== BANKS =====================

  /**
   * @swagger
   * /map-faq/banks:
   *   post:
   *     summary: إنشاء بنك خرائط جديد (خريطة واحدة + نقاط مرقّمة) مع إمكانية رفع الصورة على Cloudflare R2
   *     description: |
   *       إنشاء بنك MapFAQ جديد مرتبط بمرحلة/سنة دراسية معينة مع صورة خريطة أساسية.
   *       يمكن إما:
   *       - رفع ملف صورة الخريطة عبر الحقل file (يتم رفعها إلى R2/التخزين المحدد)، أو
   *       - تمرير mapImageUrl مباشر إذا كانت الصورة مرفوعة مسبقًا.
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - level
   *             properties:
   *               title:
   *                 type: string
   *                 example: "بنك خرائط الوطن العربي - الصف الثالث الثانوي"
   *               level:
   *                 type: string
   *                 example: "sec3"
   *                 description: كود المرحلة / السنة (يتم تمريره على normalizeLevel).
   *               status:
   *                 type: string
   *                 description: حالة البنك (مثلاً draft أو published).
   *                 example: "published"
   *                 default: "draft"
   *               orderIndex:
   *                 type: integer
   *                 description: ترتيب الظهور.
   *                 example: 1
   *                 default: 1
   *               label:
   *                 type: string
   *                 description: اسم وصفي للخريطة يُستخدم في اسم الملف داخل R2 (اختياري).
   *                 example: "arab-world"
   *               mapImageUrl:
   *                 type: string
   *                 description: رابط صورة الخريطة الأساسية (لو الصورة مرفوعة مسبقاً).
   *                 example: "https://cdn.example.com/maps/arab-world.png"
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: ملف صورة الخريطة (PNG/JPEG/WebP). لو موجود سيتم رفعه على التخزين واستخدام URL الناتج.
   *     responses:
   *       200:
   *         description: تم إنشاء البنك بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/MapBank'
   *       400:
   *         description: title أو level غير صالحين / لا يوجد صورة صالحة (لا file ولا mapImageUrl).
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.post(
    '/banks',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    upload.single('file'),
    async (req, res, next) => {
      try {
        if (!ensureBankModel(res)) return;

        const body = req.body || {};
        const file = req.file || null;

        const rawLevel = body.level;
        const level = normalizeLevel(rawLevel);
        const title = String(body.title || '').trim();
        const status = String(body.status || 'draft').trim();
        const orderIndex = Number(body.orderIndex || 1);
        const label = body.label || title || 'map';

        const mapImageUrlFromBody = String(body.mapImageUrl || '').trim();

        if (!title || !rawLevel) {
          return res.status(400).json({
            success: false,
            message: 'title و level مطلوبان',
          });
        }

        if (!level) {
          return res.status(400).json({
            success: false,
            message: 'level غير صالح',
          });
        }

        let finalMapUrl = null;

        // أولوية 1: لو في ملف → نرفعه على R2 / local
        if (file) {
          const uploaded = await uploadMapImageFromRequest(
            file,
            level,
            label
          );
          finalMapUrl = uploaded.url;
        } else if (mapImageUrlFromBody) {
          // أولوية 2: URL مباشر
          if (!validUrlMaybe(mapImageUrlFromBody)) {
            return res.status(400).json({
              success: false,
              message: 'دومين الصورة غير مسموح',
            });
          }
          finalMapUrl = mapImageUrlFromBody;
        }

        if (!finalMapUrl) {
          return res.status(400).json({
            success: false,
            message:
              'يجب توفير صورة خريطة إما عن طريق file أو mapImageUrl',
          });
        }

        const now = new Date();

        const created = await MapBankMysql.create({
          title,
          level,
          mapImageUrl: finalMapUrl,
          status,
          orderIndex,
          createdAtLocal: now,
          updatedAtLocal: now,
        });

        res.json({ success: true, data: created.toJSON() });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/banks:
   *   get:
   *     summary: الحصول على قائمة بنوك الخرائط
   *     description: فلترة حسب المستوى (level)، والبحث النصي (q)، والحالة (status). الطلاب يرون published فقط بشكل افتراضي.
   *     tags: [MapFAQ]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: نص للبحث في عنوان البنك.
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: فلترة حسب المستوى الدراسي.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           description: حالة البنك (draft أو published).
   *     responses:
   *       200:
   *         description: قائمة البنوك.
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
   *                     $ref: '#/components/schemas/MapBank'
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.get('/banks', softAuth, async (req, res, next) => {
    try {
      if (!ensureBankModel(res)) return;

      const q = String(req.query.q || '').trim();
      const levelQ = String(req.query.level || '').trim();
      const statusQ = String(req.query.status || '').trim();
      const isStudent = req.user?.role === 'student';

      const where = { isDeleted: false };

      if (q) {
        where.title = { [Op.like]: `%${q}%` };
      }

      if (levelQ) {
        where.level = normalizeLevel(levelQ) || levelQ;
      } else if (req.user?.level) {
        where.level = normalizeLevel(req.user.level) || req.user.level;
      }

      if (statusQ) {
        where.status = statusQ;
      } else if (isStudent) {
        where.status = 'published';
      }

      const rows = await MapBankMysql.findAll({
        where,
        order: [
          ['orderIndex', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      res.json({
        success: true,
        data: rows.map((r) => {
          const json = r.toJSON();
          json.secureId = encodeId(json.id);
          return json;
        }),
      });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /map-faq/banks/{bankId}:
   *   get:
   *     summary: الحصول على تفاصيل بنك خرائط وعناصره
   *     description: لو المستخدم طالب، يتم إرجاع العناصر ذات الحالة published فقط.
   *     tags: [MapFAQ]
   *     parameters:
   *       - in: path
   *         name: bankId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم البنك.
   *     responses:
   *       200:
   *         description: تفاصيل البنك + العناصر المرتبطة به.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     bank:
   *                       $ref: '#/components/schemas/MapBank'
   *                     items:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/MapBankItem'
   *       400:
   *         description: bankId غير صالح.
   *       404:
   *         description: البنك غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.get('/banks/:bankId', softAuth, async (req, res, next) => {
    try {
      if (!ensureBankModel(res) || !ensureItemModel(res)) return;

      const bankId = Number(req.params.bankId);
      if (!bankId) {
        return res
          .status(400)
          .json({ success: false, message: 'bankId غير صالح' });
      }

      const bank = await MapBankMysql.findOne({
        where: { id: bankId, isDeleted: false },
      });
      if (!bank) {
        return res
          .status(404)
          .json({ success: false, message: 'البنك غير موجود' });
      }

      const isStudent = req.user?.role === 'student';
      const whereItems = { bankId, isDeleted: false };
      if (isStudent) {
        whereItems.status = 'published';
      }

      const items = await MapBankItemMysql.findAll({
        where: whereItems,
        order: [
          ['orderIndex', 'ASC'],
          ['markerNumber', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      res.json({ success: true, data: { bank, items } });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /map-faq/banks/{bankId}:
   *   patch:
   *     summary: تعديل بنك خرائط
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: bankId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم البنك.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               level:
   *                 type: string
   *               mapImageUrl:
   *                 type: string
   *               status:
   *                 type: string
   *               orderIndex:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم تعديل البنك بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/MapBank'
   *       400:
   *         description: بيانات غير صالحة أو bankId غير صالح.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: البنك غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.patch(
    '/banks/:bankId',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureBankModel(res)) return;

        const bankId = Number(req.params.bankId);
        if (!bankId) {
          return res
            .status(400)
            .json({ success: false, message: 'bankId غير صالح' });
        }

        const bank = await MapBankMysql.findOne({
          where: { id: bankId, isDeleted: false },
        });
        if (!bank) {
          return res
            .status(404)
            .json({ success: false, message: 'البنك غير موجود' });
        }

        const patch = { updatedAtLocal: new Date() };

        if (req.body.title !== undefined) {
          patch.title = String(req.body.title).trim();
        }

        if (req.body.level !== undefined) {
          const lv = normalizeLevel(req.body.level);
          if (!lv) {
            return res
              .status(400)
              .json({ success: false, message: 'level غير صالح' });
          }
          patch.level = lv;
        }

        if (req.body.mapImageUrl !== undefined) {
          const url = String(req.body.mapImageUrl).trim();
          if (!validUrlMaybe(url)) {
            return res
              .status(400)
              .json({ success: false, message: 'دومين الصورة غير مسموح' });
          }
          patch.mapImageUrl = url;
        }

        if (req.body.status !== undefined) {
          patch.status = String(req.body.status).trim();
        }

        if (req.body.orderIndex !== undefined) {
          patch.orderIndex = Number(req.body.orderIndex);
        }

        await bank.update(patch);

        res.json({ success: true, data: bank.toJSON() });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/banks/{bankId}:
   *   delete:
   *     summary: حذف بنك خرائط (حذف ناعم)
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: bankId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم البنك.
   *     responses:
   *       200:
   *         description: تم حذف البنك (تحديث isDeleted إلى true).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: bankId غير صالح.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: البنك غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.delete(
    '/banks/:bankId',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureBankModel(res)) return;

        const bankId = Number(req.params.bankId);
        if (!bankId) {
          return res
            .status(400)
            .json({ success: false, message: 'bankId غير صالح' });
        }

        const bank = await MapBankMysql.findOne({
          where: { id: bankId, isDeleted: false },
        });
        if (!bank) {
          return res
            .status(404)
            .json({ success: false, message: 'البنك غير موجود' });
        }

        await bank.update({
          isDeleted: true,
          updatedAtLocal: new Date(),
        });

        res.json({ success: true, message: 'تم حذف البنك' });
      } catch (e) {
        next(e);
      }
    }
  );

  // ===================== ITEMS =====================

  /**
   * @swagger
   * /map-faq/banks/{bankId}/items:
   *   post:
   *     summary: إنشاء عنصر واحد داخل بنك خرائط
   *     description: كل عنصر يمثل رقمًا على الخريطة + سؤال + إجابة اختيارية.
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: bankId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم البنك المرتبط بالعنصر.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - markerNumber
   *               - prompt
   *             properties:
   *               markerNumber:
   *                 type: integer
   *                 description: رقم الماركر على الخريطة (1, 2, 3...).
   *               prompt:
   *                 type: string
   *               answerText:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               status:
   *                 type: string
   *                 description: draft أو published.
   *               orderIndex:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم إنشاء العنصر بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/MapBankItem'
   *       400:
   *         description: bankId أو markerNumber أو prompt غير صالحين.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: البنك غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.post(
    '/banks/:bankId/items',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureBankModel(res) || !ensureItemModel(res)) return;

        const bankId = Number(req.params.bankId);
        if (!bankId) {
          return res
            .status(400)
            .json({ success: false, message: 'bankId غير صالح' });
        }

        const bank = await MapBankMysql.findOne({
          where: { id: bankId, isDeleted: false },
        });
        if (!bank) {
          return res
            .status(404)
            .json({ success: false, message: 'البنك غير موجود' });
        }

        const b = req.body || {};
        const markerNumber = Number(b.markerNumber || 0);
        const prompt = String(b.prompt || '').trim();

        if (!markerNumber || !prompt) {
          return res.status(400).json({
            success: false,
            message: 'markerNumber و prompt مطلوبان',
          });
        }

        const now = new Date();

        const data = {
          bankId,
          markerNumber,
          prompt,
          answerText: b.answerText ?? null,
          tags: normalizeTags(b.tags),
          status: String(b.status || 'draft'),
          orderIndex: Number(b.orderIndex || 1),
          createdAtLocal: now,
          updatedAtLocal: now,
          isDeleted: false,
        };

        const created = await MapBankItemMysql.create(data);

        res.json({ success: true, data: created.toJSON() });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/banks/{bankId}/items/batch:
   *   post:
   *     summary: إنشاء مجموعة عناصر داخل بنك خرائط في طلب واحد
   *     description: تستخدم لإضافة أسئلة متعددة (أرقام متعددة على نفس الخريطة) مرة واحدة.
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: bankId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم البنك المرتبط بالعناصر.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - items
   *             properties:
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - markerNumber
   *                     - prompt
   *                   properties:
   *                     markerNumber:
   *                       type: integer
   *                     prompt:
   *                       type: string
   *                     answerText:
   *                       type: string
   *                     tags:
   *                       type: array
   *                       items:
   *                         type: string
   *                     status:
   *                       type: string
   *                     orderIndex:
   *                       type: integer
   *     responses:
   *       200:
   *         description: تم إنشاء العناصر بنجاح.
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
   *                     $ref: '#/components/schemas/MapBankItem'
   *       400:
   *         description: bankId غير صالح أو items[] مفقودة / غير صالحة.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: البنك غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.post(
    '/banks/:bankId/items/batch',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureBankModel(res) || !ensureItemModel(res)) return;

        const bankId = Number(req.params.bankId);
        if (!bankId) {
          return res
            .status(400)
            .json({ success: false, message: 'bankId غير صالح' });
        }

        const bank = await MapBankMysql.findOne({
          where: { id: bankId, isDeleted: false },
        });
        if (!bank) {
          return res
            .status(404)
            .json({ success: false, message: 'البنك غير موجود' });
        }

        const items = Array.isArray(req.body?.items)
          ? req.body.items
          : [];
        if (!items.length) {
          return res
            .status(400)
            .json({ success: false, message: 'items[] مطلوبة' });
        }

        const createdAll = [];

        for (const it of items) {
          const markerNumber = Number(it.markerNumber || 0);
          const prompt = String(it.prompt || '').trim();

          // لو ناقص واحد منهم نعدّيه
          if (!markerNumber || !prompt) continue;

          const now = new Date();

          const data = {
            bankId,
            markerNumber,
            prompt,
            answerText: it.answerText ?? null,
            tags: normalizeTags(it.tags),
            status: String(it.status || 'draft'),
            orderIndex: Number(it.orderIndex || 1),
            createdAtLocal: now,
            updatedAtLocal: now,
            isDeleted: false,
          };

          const created = await MapBankItemMysql.create(data);
          createdAll.push(created.toJSON());
        }

        res.json({ success: true, data: createdAll });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/items/{itemId}:
   *   patch:
   *     summary: تعديل عنصر بنك خرائط
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم العنصر.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               markerNumber:
   *                 type: integer
   *               prompt:
   *                 type: string
   *               answerText:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               status:
   *                 type: string
   *               orderIndex:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم تعديل العنصر بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/MapBankItem'
   *       400:
   *         description: itemId غير صالح أو بيانات غير صالحة.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: العنصر غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.patch(
    '/items/:itemId',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureItemModel(res)) return;

        const itemId = Number(req.params.itemId);
        if (!itemId) {
          return res
            .status(400)
            .json({ success: false, message: 'itemId غير صالح' });
        }

        const item = await MapBankItemMysql.findOne({
          where: { id: itemId, isDeleted: false },
        });
        if (!item) {
          return res
            .status(404)
            .json({ success: false, message: 'العنصر غير موجود' });
        }

        const b = req.body || {};

        const patch = { updatedAtLocal: new Date() };

        if (b.markerNumber !== undefined) {
          const markerNumber = Number(b.markerNumber);
          if (!markerNumber) {
            return res.status(400).json({
              success: false,
              message: 'markerNumber غير صالح',
            });
          }
          patch.markerNumber = markerNumber;
        }

        if (b.prompt !== undefined) {
          patch.prompt = String(b.prompt).trim();
        }

        if (b.answerText !== undefined) {
          patch.answerText = b.answerText ?? null;
        }

        if (b.tags !== undefined) {
          patch.tags = normalizeTags(b.tags);
        }

        if (b.status !== undefined) {
          patch.status = String(b.status).trim();
        }

        if (b.orderIndex !== undefined) {
          patch.orderIndex = Number(b.orderIndex);
        }

        await item.update(patch);

        res.json({ success: true, data: item.toJSON() });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/items/{itemId}:
   *   delete:
   *     summary: حذف عنصر بنك خرائط (حذف ناعم)
   *     tags: [MapFAQ]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم العنصر.
   *     responses:
   *       200:
   *         description: تم حذف العنصر (تحديث isDeleted إلى true).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: itemId غير صالح.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: مصرّح للمشرفين/المستخدمين فقط.
   *       404:
   *         description: العنصر غير موجود.
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.delete(
    '/items/:itemId',
    requireAuth,
    requireRole('admin', 'supervisor', 'support', 'user'),
    async (req, res, next) => {
      try {
        if (!ensureItemModel(res)) return;

        const itemId = Number(req.params.itemId);
        if (!itemId) {
          return res
            .status(400)
            .json({ success: false, message: 'itemId غير صالح' });
        }

        const item = await MapBankItemMysql.findOne({
          where: { id: itemId, isDeleted: false },
        });
        if (!item) {
          return res
            .status(404)
            .json({ success: false, message: 'العنصر غير موجود' });
        }

        await item.update({
          isDeleted: true,
          updatedAtLocal: new Date(),
        });

        res.json({ success: true, message: 'تم حذف العنصر' });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /map-faq/items:
   *   get:
   *     summary: البحث في عناصر بنوك الخرائط
   *     description: فلترة حسب البنك، نص السؤال، رقم الماركر، والوسوم. لو المستخدم طالب، يتم إرجاع العناصر published فقط.
   *     tags: [MapFAQ]
   *     parameters:
   *       - in: query
   *         name: bankId
   *         schema:
   *           type: integer
   *         description: رقم البنك للفلترة.
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: نص للبحث في prompt.
   *       - in: query
   *         name: markerNumber
   *         schema:
   *           type: integer
   *         description: فلترة حسب رقم الماركر على الخريطة.
   *       - in: query
   *         name: tags
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         style: form
   *         explode: true
   *         description: مجموعة وسوم يجب أن تتواجد كلها في العنصر.
   *     responses:
   *       200:
   *         description: قائمة العناصر المطابقة.
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
   *                     $ref: '#/components/schemas/MapBankItem'
   *       500:
   *         description: خطأ في السيرفر.
   */
  router.get('/items', softAuth, async (req, res, next) => {
    try {
      if (!ensureItemModel(res)) return;

      const bankId = Number(req.query.bankId || 0);
      const q = String(req.query.q || '').trim();
      const markerNumber = Number(req.query.markerNumber || 0);

      let tagsParam = req.query.tags;
      let tags = null;
      if (Array.isArray(tagsParam)) {
        tags = tagsParam;
      } else if (typeof tagsParam === 'string' && tagsParam.trim()) {
        tags = [tagsParam];
      }

      const isStudent = req.user?.role === 'student';

      const where = { isDeleted: false };

      if (bankId) where.bankId = bankId;
      if (q) where.prompt = { [Op.like]: `%${q}%` };
      if (markerNumber) where.markerNumber = markerNumber;
      if (isStudent) where.status = 'published';

      const rows = await MapBankItemMysql.findAll({
        where,
        order: [
          ['orderIndex', 'ASC'],
          ['markerNumber', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      const tagsNormalized = normalizeTags(tags);
      const filtered =
        tagsNormalized && tagsNormalized.length
          ? rows.filter((r) => {
              const t = Array.isArray(r.tags) ? r.tags : [];
              return tagsNormalized.every((tag) => t.includes(tag));
            })
          : rows;

      res.json({ success: true, data: filtered });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
