// src/routes/live-requests.routes.js
import { Router } from "express";
import { Op } from "sequelize";
import softAuth from "../middlewares/soft-auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

// نفس الريجيكس بتاع الطلاب (01 + 9 أرقام)
const phoneRegex = /^01\d{9}$/;

function validateBody(body) {
  const errors = [];
  const name = String(body?.name || "").trim();
  const phone = String(body?.phone || "").trim();

  if (!name || name.length < 3) {
    errors.push("الاسم مطلوب وبحد أدنى 3 أحرف.");
  }

  if (!phone || !phoneRegex.test(phone)) {
    errors.push("رقم واتساب غير صالح (01 + 9 أرقام).");
  }

  return { errors, name, phone };
}

/**
 * helper لتحويل صف الـ Sequelize لشكل موحّد للداشبورد
 * بيدّي createdAt جاهزة + studentName + note
 */
function mapRequestRow(row) {
  const r = row.toJSON ? row.toJSON() : row;

  // حاول تلاقي تاريخ مناسب: createdAtLocal -> createdAt -> updatedAtLocal
  const createdAt =
    r.createdAtLocal || r.createdAt || r.updatedAtLocal || null;

  // اسم العرض:
  // لو عندك studentName في الجدول استخدمه، وإلا name بتاع الفورم
  const studentName = r.studentName || r.name || null;

  return {
    id: r.id,
    studentId: r.studentId ?? null,
    studentName, // للداشبورد
    name: r.name ?? null, // الاسم الأصلي كما هو
    phone: r.phone,
    source: r.source || "site",
    status: r.status || "new", // new | contacted | ignored
    note: r.note ?? r.notes ?? null,
    meetLink: r.meetLink ?? null,
    scheduledAt: r.scheduledAt ?? null,
    createdAt,
  };
}

/**
 * @swagger
 * tags:
 *   name: LiveRequests
 *   description: |
 *     إدارة طلبات حجز الجلسات / اللايف:
 *     - استقبال طلب من الطالب أو الضيف عبر الفورم.
 *     - استعراض الطلبات في الداشبورد.
 *     - تحديث حالة الطلب وتسجيل الملاحظات ومعاد الجلسة.
 *
 * components:
 *   schemas:
 *     LiveSessionRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *           nullable: true
 *         studentName:
 *           type: string
 *           nullable: true
 *           description: اسم الطالب لو مرتبط بحساب، أو null لو ضيف.
 *         name:
 *           type: string
 *           nullable: true
 *           description: الاسم كما تم إدخاله في الفورم.
 *         phone:
 *           type: string
 *           description: رقم الواتساب (01 + 9 أرقام).
 *         source:
 *           type: string
 *           enum: [site, whatsapp, call]
 *           description: مصدر الطلب.
 *         status:
 *           type: string
 *           enum: [new, contacted, ignored]
 *           description: حالة الطلب في الداشبورد.
 *         note:
 *           type: string
 *           nullable: true
 *           description: الملاحظات الداخلية على الطلب.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

export function createLiveRequestsRouter(models) {
  const router = Router();

const StudentMysql = models.StudentMysql || models.Student;
  const LiveSessionRequestMysql = models.LiveSessionRequestMysql || models.LiveSessionRequest;

  // تحقق فوراً لضمان عدم حدوث الخطأ لاحقاً
  if (!LiveSessionRequestMysql) {
     console.error("❌ Fatal Error: LiveSessionRequest model is missing!");
  }

  // ========== إنشاء طلب حجز جديد (فورم / لايف) ==========
  // ممكن طالب مسجل دخول (softAuth) أو ضيف

  /**
   * @swagger
   * /live-requests:
   *   post:
   *     summary: إنشاء طلب جلسة لايف جديد
   *     description: |
   *       يستقبل طلب حجز جلسة لايف من طالب مسجّل دخول أو ضيف.
   *       لو رقم الواتساب يطابق طالب موجود، بيتم ربط الطلب بالطالب تلقائيًا.
   *     tags: [LiveRequests]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - phone
   *             properties:
   *               name:
   *                 type: string
   *                 description: اسم الطالب / الشخص الذي حجز الجلسة (حد أدنى 3 أحرف).
   *               phone:
   *                 type: string
   *                 description: رقم الواتساب بصيغة مصرية (01 + 9 أرقام).
   *                 example: "01012345678"
   *               source:
   *                 type: string
   *                 description: مصدر الطلب.
   *                 enum: [site, whatsapp, call]
   *                 default: site
   *               notes:
   *                 type: string
   *                 nullable: true
   *                 description: ملاحظات إضافية من الفورم (اختياري).
   *     responses:
   *       200:
   *         description: تم إنشاء الطلب بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/LiveSessionRequest'
   *       400:
   *         description: بيانات غير صالحة (مثلاً الاسم أقل من 3 أحرف أو رقم واتساب غير صحيح).
   */
  router.post("/", softAuth, async (req, res, next) => {
    try {
      const body = req.body || {};
      const { errors, name, phone } = validateBody(body);

      if (errors.length) {
        return res.status(400).json({ success: false, errors });
      }

      // ربط بالطالب (لو لوجين أو بنفس رقم الطالب)
      let studentId = null;

      if (req.user?.role === "student" && req.user?.id) {
        studentId = Number(req.user.id) || null;
      } else if (StudentMysql) {
        const s = await StudentMysql.findOne({
          where: { studentPhone: phone },
        });
        if (s) studentId = s.id;
      }

      // مصدر الطلب: site | whatsapp | call
      const rawSource = String(body.source || "").trim();
      const allowedSources = ["site", "whatsapp", "call"];
      const source = allowedSources.includes(rawSource) ? rawSource : "site";

      const now = new Date();

      const data = {
        studentId,
        name,
        phone,
        source,
        status: "new", // طلب جديد للداشبورد
        notes: body.notes ? String(body.notes).trim() || null : null,
        createdAtLocal: now,
        updatedAtLocal: now,
      };

      const created = await LiveSessionRequestMysql.create(data);

      // رجّع الشكل الموحّد
      return res.json({ success: true, data: mapRequestRow(created) });
    } catch (e) {
      next(e);
    }
  });

  // ========== لستة الطلبات (لوحة الإدارة – آخر 100) ==========

  /**
   * @swagger
   * /live-requests:
   *   get:
   *     summary: قائمة طلبات اللايف (لوحة الإدارة)
   *     description: |
   *       إرجاع آخر 100 طلب جلسة لايف مع إمكانية الفلترة بالحالة أو برقم الواتساب.
   *       متاحة للأدمن فقط.
   *     tags: [LiveRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         required: false
   *         description: فلترة حسب الحالة (new | contacted | ignored).
   *         schema:
   *           type: string
   *       - in: query
   *         name: phone
   *         required: false
   *         description: بحث جزئي برقم الواتساب.
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: قائمة الطلبات.
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
   *                     $ref: '#/components/schemas/LiveSessionRequest'
   *       401:
   *         description: غير مصرح (بدون توكن أو توكن غير صالح).
   *       403:
   *         description: الوصول مرفوض (يتطلب دور admin).
   */
  router.get(
    "/",
    requireAuth,
    requireRole("admin" , "user"),
    async (req, res, next) => {
      try {
        const status = String(req.query.status || "").trim();
        const qPhone = String(req.query.phone || "").trim();

        const where = {};
        if (status) where.status = status; // new | contacted | ignored
        if (qPhone) where.phone = { [Op.like]: `%${qPhone}%` };

        const rows = await LiveSessionRequestMysql.findAll({
          where,
          order: [["id", "DESC"]],
          limit: 100,
        });

        const data = rows.map(mapRequestRow);

        return res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  // ========== طلبات الطالب الحالي (لو حبيت تعرضها له) ==========

  /**
   * @swagger
   * /live-requests/my:
   *   get:
   *     summary: طلبات الجلسات الخاصة بالطالب الحالي
   *     description: |
   *       يعرض كل طلبات الجلسات التي قام بها الطالب الحالي (حسب studentId من التوكن).
   *       متاحة للطلاب فقط.
   *     tags: [LiveRequests]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الطلبات المرتبطة بالطالب.
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
   *                     $ref: '#/components/schemas/LiveSessionRequest'
   *       401:
   *         description: غير مصرح (بدون توكن أو توكن غير صالح).
   *       403:
   *         description: الوصول مرفوض (الحساب ليس طالبًا).
   */
  router.get("/my", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط." });
      }

      const studentId = Number(req.user.id);
      const rows = await LiveSessionRequestMysql.findAll({
        where: { studentId },
        order: [["id", "DESC"]],
      });

      const data = rows.map(mapRequestRow);

      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  // ========== تحديث حالة الطلب / ملاحظات / معاد ==========
  // تستخدمها لوحة الإدارة

  /**
   * @swagger
   * /live-requests/{id}:
   *   patch:
   *     summary: تحديث حالة طلب جلسة لايف
   *     description: |
   *       تستخدم في لوحة الإدارة لتحديث حالة الطلب، معاد الجلسة، أو الملاحظات.
   *     tags: [LiveRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: معرف الطلب.
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 description: حالة الطلب.
   *                 enum: [new, contacted, ignored]
   *               scheduledAt:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *                 description: معاد الجلسة (اختياري، يمكن إرساله null لمسح القيمة).
   *               notes:
   *                 type: string
   *                 nullable: true
   *                 description: ملاحظات داخلية على الطلب.
   *     responses:
   *       200:
   *         description: تم تحديث الطلب بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/LiveSessionRequest'
   *       400:
   *         description: ID غير صالح أو بيانات غير صالحة (حالة أو تاريخ خاطئ).
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: الوصول مرفوض (يتطلب دور admin).
   *       404:
   *         description: الطلب غير موجود.
   */
  router.patch(
    "/:id",
    requireAuth,
    requireRole("admin"   , "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const requestRow = await LiveSessionRequestMysql.findByPk(id);
        if (!requestRow) {
          return res
            .status(404)
            .json({ success: false, message: "الطلب غير موجود" });
        }

        const body = req.body || {};
        const patch = { updatedAtLocal: new Date() };

        // حالة الlead في الداشبورد
        if (body.status) {
          const allowed = ["new", "contacted", "ignored"];
          if (!allowed.includes(body.status)) {
            return res.status(400).json({
              success: false,
              message: "حالة غير صالحة",
            });
          }
          patch.status = body.status;
        }

        // معاد الجلسة (اختياري – لو حابب تستخدمه)
        if (body.scheduledAt !== undefined) {
          if (!body.scheduledAt) {
            patch.scheduledAt = null;
          } else {
            const d = new Date(body.scheduledAt);
            if (Number.isNaN(d.getTime())) {
              return res.status(400).json({
                success: false,
                message: "تاريخ/وقت غير صالح",
              });
            }
            patch.scheduledAt = d;
          }
        }

        // ملاحظات
        if (body.notes !== undefined) {
          patch.notes = String(body.notes || "").trim() || null;
        }

        // رابط الاجتماع
        if (body.meetLink !== undefined) {
          patch.meetLink = String(body.meetLink || "").trim() || null;
        }

        await LiveSessionRequestMysql.update(patch, { where: { id } });

        const fresh = await LiveSessionRequestMysql.findByPk(id);
        return res.json({ success: true, data: mapRequestRow(fresh) });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}

export default createLiveRequestsRouter;
