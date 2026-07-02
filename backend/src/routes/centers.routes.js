// src/routes/centers.routes.js
import { Router } from "express";
import { Op, fn, col } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { EGYPT_GOVERNORATES } from "../utils/egypt-governorates.js";
import { LEVELS_AR, normalizeLevel } from "../utils/levels.js";

/**
 * @swagger
 * tags:
 *   - name: Centers
 *     description: إدارة وعرض سناتر الحضور (مراكز السنتر) للطلبة والأدمن
 *
 * components:
 *   schemas:
 *     CenterScheduleItem:
 *       type: object
 *       description: بند في جدول المواعيد الأسبوعية للسنتر
 *       properties:
 *         weekday:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: 0 = الأحد، 6 = السبت (أو حسب تعريفك الداخلي)
 *         from:
 *           type: string
 *           example: "15:00"
 *         to:
 *           type: string
 *           example: "19:00"
 *         level:
 *           type: string
 *           nullable: true
 *           description: المرحلة/السنة المستهدفة في هذا المعاد (اختياري)
 *
 *     CenterBase:
 *       type: object
 *       description: البيانات الأساسية للسنتر
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *           nullable: true
 *         name:
 *           type: string
 *         region:
 *           type: string
 *           description: المحافظة
 *         city:
 *           type: string
 *           nullable: true
 *           description: المدينة (إن وُجدت، وإلا قد تُستخدم region فقط)
 *         addressLine:
 *           type: string
 *         mapsUrl:
 *           type: string
 *           nullable: true
 *           description: رابط خرائط جوجل (إن تم ضبطه)
 *         levelsSupported:
 *           type: array
 *           nullable: true
 *           items:
 *             type: string
 *           description: قائمة السنوات/المستويات التي يخدمها السنتر
 *         schedule:
 *           type: array
 *           nullable: true
 *           items:
 *             $ref: '#/components/schemas/CenterScheduleItem'
 *         managerName:
 *           type: string
 *           nullable: true
 *         managerPhone:
 *           type: string
 *           nullable: true
 *         whatsapp:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         isDeleted:
 *           type: boolean
 *
 *     CenterWithStats:
 *       allOf:
 *         - $ref: '#/components/schemas/CenterBase'
 *         - type: object
 *           properties:
 *             studentCount:
 *               type: integer
 *               description: عدد الطلاب المنسوبين لهذا السنتر
 *
 *     CentersCitySummary:
 *       type: object
 *       properties:
 *         city:
 *           type: string
 *         count:
 *           type: integer
 *           description: عدد السناتر في هذه المدينة
 */

// تحقّق أساسي لرابط خرائط جوجل
function isAllowedMapsUrl(url) {
  if (!url) return true; // اختياري
  try {
    const u = new URL(String(url).trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    const allowed = [
      "google.com",
      "www.google.com",
      "maps.google.com",
      "goo.gl",
      "maps.app.goo.gl",
      "g.page",
    ];
    return (
      host.endsWith("google.com") ||
      host === "maps.google.com" ||
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && u.pathname.startsWith("/maps")) ||
      host === "g.page"
    );
  } catch {
    return false;
  }
}

// تطبيع مصفوفة السنوات المدعومة للسنتر (مدخل للـ DB)
function normalizeLevels(arr) {
  const s = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    const norm = normalizeLevel(v);
    if (norm) s.add(norm);
  }
  return Array.from(s);
}

function validateSchedule(items) {
  if (!Array.isArray(items)) return [];
  const errors = [];
  for (const it of items) {
    const weekday = Number(it?.weekday);
    const from = String(it?.from || "").trim();
    const to = String(it?.to || "").trim();
    if (!(weekday >= 0 && weekday <= 6))
      errors.push("weekday يجب أن يكون 0..6");
    if (!/^\d{2}:\d{2}$/.test(from)) errors.push("from بصيغة HH:mm");
    if (!/^\d{2}:\d{2}$/.test(to)) errors.push("to بصيغة HH:mm");
    if (from && to && from >= to) errors.push("from يجب أن يكون قبل to");

    if (it.level) {
      const lNorm = normalizeLevel(it.level);
      if (!lNorm) errors.push("level في schedule غير صالح");
    }

    if (errors.length) break;
  }
  return errors;
}

// التحقق من اسم المحافظة من اللستة
function validateRegionName(region) {
  const r = String(region || "").trim();
  if (!r) return "المحافظة مطلوبة";
  if (!EGYPT_GOVERNORATES.includes(r)) return "المحافظة غير صالحة";
  return null;
}

// تطبيع سجل سنتر خارج من الـ DB (schedule / levelsSupported) عشان يرجع دايمًا Arrays
function normalizeCenterRecord(rec) {
  if (!rec) return rec;

  const json = rec.toJSON ? rec.toJSON() : { ...rec };

  // schedule
  const rawSchedule = json.schedule;
  if (rawSchedule != null && !Array.isArray(rawSchedule)) {
    if (typeof rawSchedule === "string") {
      const trimmed = rawSchedule.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            json.schedule = parsed;
          } else {
            json.schedule = null;
          }
        } catch {
          json.schedule = null;
        }
      } else {
        json.schedule = null;
      }
    } else {
      json.schedule = null;
    }
  }

  // levelsSupported
  const rawLevels = json.levelsSupported;
  if (rawLevels != null && !Array.isArray(rawLevels)) {
    if (typeof rawLevels === "string") {
      const trimmed = rawLevels.trim();
      if (trimmed) {
        // نحاول JSON.parse الأول
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            json.levelsSupported = parsed;
          } else {
            json.levelsSupported = trimmed
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
          }
        } catch {
          // fallback: comma-separated
          json.levelsSupported = trimmed
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        }
      } else {
        json.levelsSupported = null;
      }
    } else {
      json.levelsSupported = null;
    }
  }

  return json;
}

export default function createCentersRouter(models) {
  const router = Router();

  const { CenterMysql, Center, StudentMysql, Student } = models;

  // موديلات موحّدة تدعم كل التسميات المحتملة
  const CenterModel =
    CenterMysql || Center || models.CenterMysql || models.Center || null;

  const StudentModel =
    StudentMysql || Student || models.StudentMysql || models.Student || null;

  if (!CenterModel) {
    throw new Error("Center model (Center / CenterMysql) is not configured");
  }

  // ===================================================================
  // 🧑‍🎓 أولاً: Routes عامة / للطلبة (قراءة بيانات السناتر)
  // ===================================================================

  /**
   * @swagger
   * /centers/regions:
   *   get:
   *     summary: قائمة المحافظات المتاحة
   *     description: ترجع اللستة الثابتة للمحافظات من EGYPT_GOVERNORATES لاستخدامها في الفلاتر والنماذج.
   *     tags: [Centers]
   *     responses:
   *       200:
   *         description: قائمة المحافظات
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
   *                     type: string
   */
  // GET /centers/regions
  router.get("/regions", (_req, res) => {
    res.json({ success: true, data: EGYPT_GOVERNORATES });
  });

  /**
   * @swagger
   * /centers/cities:
   *   get:
   *     summary: لستة المدن مع عدد السناتر في كل مدينة
   *     description: |
   *       يرجع المدن (distinct) المستخرجة من السناتر، مع عدد السناتر في كل مدينة.
   *       - يمكن الفلترة على المرحلة `level`.
   *       - يمكن الفلترة على حالة التفعيل `active` (true/false).
   *     tags: [Centers]
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         required: false
   *         description: المرحلة/السنة (يتم تطبيعها بـ normalizeLevel)
   *       - in: query
   *         name: active
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         required: false
   *         description: فلترة بحسب حالة تفعيل السنتر
   *     responses:
   *       200:
   *         description: قائمة المدن مع عدد السناتر في كل مدينة
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
   *                     $ref: '#/components/schemas/CentersCitySummary'
   */
  // GET /centers/cities?level=...&active=true
  router.get("/cities", async (req, res, next) => {
    try {
      const levelRaw = req.query.level?.toString().trim() || "";
      const levelNorm = levelRaw ? normalizeLevel(levelRaw) : null;
      const activeQ = req.query.active?.toString().trim(); // 'true' | 'false' | undefined

      const where = { isDeleted: false };
      if (activeQ === "true") where["isActive"] = true;
      if (activeQ === "false") where["isActive"] = false;

      const rows = await CenterModel.findAll({
        where,
        attributes: ["city", "region", "levelsSupported", "isActive", "schedule"],
      });

      let filtered = rows.map((r) => normalizeCenterRecord(r)).filter((r) => {
        const cityName = (r.city || r.region || "").toString().trim();
        return !!cityName;
      });

      if (levelNorm) {
        filtered = filtered.filter((r) => {
          const arr = Array.isArray(r.levelsSupported) ? r.levelsSupported : [];
          return !arr.length || arr.includes(levelNorm);
        });
      }

      const map = new Map(); // cityName -> count
      for (const r of filtered) {
        const cityName = (r.city || r.region || "").toString().trim();
        if (!cityName) continue;
        map.set(cityName, (map.get(cityName) || 0) + 1);
      }

      const data = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "ar"))
        .map(([city, count]) => ({ city, count }));

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /centers:
   *   get:
   *     summary: قائمة السناتر مع فلاتر متقدمة
   *     description: |
   *       إرجاع قائمة السناتر مع إمكانية الفلترة بالمحافظة، المدينة، المرحلة، وحالة التفعيل.
   *       - يمكن كذلك طلب إحصائية عدد الطلاب في كل سنتر بإرسال `withStats=true`.
   *     tags: [Centers]
   *     parameters:
   *       - in: query
   *         name: region
   *         schema:
   *           type: string
   *         required: false
   *         description: اسم المحافظة (يتم مطابقته مباشرة مع Center.region)
   *       - in: query
   *         name: city
   *         schema:
   *           type: string
   *         required: false
   *         description: المدينة (أو region في بعض الداتا القديمة)
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         required: false
   *         description: المرحلة/السنة (يتم تطبيعها بـ normalizeLevel)
   *       - in: query
   *         name: active
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         required: false
   *         description: فلترة السناتر المفعّلة/غير المفعّلة
   *       - in: query
   *         name: withStats
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         required: false
   *         description: لو true يتم إرجاع studentCount لكل سنتر
   *     responses:
   *       200:
   *         description: قائمة السناتر
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
   *                     oneOf:
   *                       - $ref: '#/components/schemas/CenterBase'
   *                       - $ref: '#/components/schemas/CenterWithStats'
   */
  // GET /centers
  router.get("/", async (req, res, next) => {
    try {
      const region = req.query.region?.toString().trim() || "";
      const city = req.query.city?.toString().trim() || "";
      const levelRaw = req.query.level?.toString().trim() || "";
      const levelNorm = levelRaw ? normalizeLevel(levelRaw) : null;
      const active = req.query.active?.toString().trim(); // 'true' | 'false' | undefined
      const withStats = req.query.withStats?.toString().trim() === "true";

      const where = { isDeleted: false };
      if (region) where["region"] = region;

      if (city) {
        where[Op.or] = [
          { city }, // سنتر فيه city متخزنة
          { city: null, region: city }, // سنتر قديم المنطقة فيه متخزنة كـ region
        ];
      }

      if (active === "true") where["isActive"] = true;
      if (active === "false") where["isActive"] = false;

      const rows = await CenterModel.findAll({
        where,
        order: [["id", "ASC"]],
      });

      // تطبيع الداتا الخارجة من الـ DB
      let data = rows.map((r) => normalizeCenterRecord(r));

      if (levelNorm) {
        data = data.filter((r) => {
          const arr = Array.isArray(r.levelsSupported) ? r.levelsSupported : [];
          return arr.includes(levelNorm);
        });
      }

      if (withStats) {
        if (!StudentModel) {
          return res.status(500).json({
            success: false,
            message: "Student model (Student / StudentMysql) is not configured",
          });
        }

        const ids = data.map((d) => d.id);
        if (ids.length) {
          const counts = await StudentModel.findAll({
            attributes: ["centerId", [fn("COUNT", col("id")), "c"]],
            where: { centerId: { [Op.in]: ids } },
            group: ["centerId"],
            raw: true,
          });
          const map = new Map(
            counts.map((x) => [Number(x.centerId), Number(x.c)])
          );
          data = data.map((d) => ({
            ...d,
            studentCount: map.get(d.id) || 0,
          }));
        } else {
          data = data.map((d) => ({ ...d, studentCount: 0 }));
        }
      }

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /centers/{id}:
   *   get:
   *     summary: قراءة بيانات سنتر واحد
   *     tags: [Centers]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: رقم السنتر
   *     responses:
   *       200:
   *         description: بيانات السنتر
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CenterBase'
   *       404:
   *         description: السنتر غير موجود أو محذوف
   */
  // GET /centers/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const center = await CenterModel.findOne({
        where: { id, isDeleted: false },
      });
      if (!center)
        return res
          .status(404)
          .json({ success: false, message: "غير موجود" });

      res.json({ success: true, data: normalizeCenterRecord(center) });
    } catch (e) {
      next(e);
    }
  });

  // ===================================================================
  // 🛠️ ثانيًا: Routes الأدمن (إدارة السناتر: إضافة / تعديل / حذف)
  // ===================================================================

  /**
   * @swagger
   * /centers:
   *   post:
   *     summary: إنشاء سنتر جديد
   *     tags: [Centers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             allOf:
   *               - $ref: '#/components/schemas/CenterBase'
   *             required:
   *               - name
   *               - region
   *               - addressLine
   *     responses:
   *       200:
   *         description: تم إنشاء السنتر بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CenterBase'
   *       400:
   *         description: بيانات غير صالحة (schedule / mapsUrl / region أو حقول أساسية ناقصة)
   */
  // POST /centers
  router.post(
    "/",
    requireAuth,
    requireRole("admin", "supervisor", "center_manager"),
    async (req, res, next) => {
      try {
        const b = req.body || {};
        const levels = normalizeLevels(b.levelsSupported);
        const schErr = validateSchedule(b.schedule);
        if (schErr.length)
          return res.status(400).json({ success: false, errors: schErr });

        const mapsUrl = b.mapsUrl?.trim() || null;
        if (mapsUrl && !isAllowedMapsUrl(mapsUrl)) {
          return res
            .status(400)
            .json({ success: false, message: "رابط خرائط غير صالح" });
        }

        const regionErr = validateRegionName(b.region);
        if (regionErr) {
          return res.status(400).json({ success: false, message: regionErr });
        }

        const data = {
          code: b.code?.trim() || null,
          name: String(b.name || "").trim(),
          region: String(b.region || "").trim(), // محافظة
          city: b.city?.trim() || null, // المدينة
          addressLine: String(b.addressLine || "").trim(),

          mapsUrl,

          levelsSupported: levels.length ? levels : null,
          schedule: Array.isArray(b.schedule) ? b.schedule : null,

          managerName: b.managerName?.trim() || null,
          managerPhone: b.managerPhone?.trim() || null,
          whatsapp: b.whatsapp?.trim() || null,
          email: b.email?.trim() || null,

          isActive: b.isActive !== undefined ? !!b.isActive : true,
          isDeleted: false,
          updatedAtLocal: new Date(),
        };

        if (!data.name || !data.region || !data.addressLine) {
          return res.status(400).json({
            success: false,
            message: "name و region و addressLine مطلوبة",
          });
        }

        const created = await CenterModel.create(data);

        res.json({ success: true, data: normalizeCenterRecord(created) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /centers/{id}:
   *   patch:
   *     summary: تعديل بيانات سنتر موجود
   *     tags: [Centers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: رقم السنتر
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: الحقول المراد تعديلها فقط (patch)
   *     responses:
   *       200:
   *         description: تم تحديث بيانات السنتر بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *       400:
   *         description: بيانات غير صالحة (schedule / mapsUrl / region)
   *       404:
   *         description: السنتر غير موجود
   */
  // PATCH /centers/:id
  router.patch(
    "/:id",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const center = await CenterModel.findOne({
          where: { id, isDeleted: false },
        });
        if (!center)
          return res
            .status(404)
            .json({ success: false, message: "السنتر غير موجود" });

        const b = req.body || {};
        const patch = { updatedAtLocal: new Date() };

        if (b.levelsSupported !== undefined)
          patch.levelsSupported = normalizeLevels(b.levelsSupported);

        if (b.schedule !== undefined) {
          const schErr = validateSchedule(b.schedule);
          if (schErr.length)
            return res.status(400).json({ success: false, errors: schErr });
          patch.schedule = b.schedule;
        }

        if (b.mapsUrl !== undefined) {
          const m = String(b.mapsUrl || "").trim();
          if (m && !isAllowedMapsUrl(m)) {
            return res
              .status(400)
              .json({ success: false, message: "رابط خرائط غير صالح" });
          }
          patch.mapsUrl = m || null;
        }

        if (b.region !== undefined) {
          const regionErr = validateRegionName(b.region);
          if (regionErr) {
            return res
              .status(400)
              .json({ success: false, message: regionErr });
          }
          patch.region = String(b.region || "").trim();
        }

        if (b.city !== undefined) {
          const c = String(b.city || "").trim();
          patch.city = c || null;
        }

        [
          "code",
          "name",
          "addressLine",
          "managerName",
          "managerPhone",
          "whatsapp",
          "email",
        ].forEach((k) => {
          if (b[k] !== undefined) patch[k] = b[k];
        });

        if (b.isActive !== undefined) patch.isActive = !!b.isActive;
        if (b.isDeleted !== undefined) patch.isDeleted = !!b.isDeleted;

        await center.update(patch);

        res.json({ success: true, data: normalizeCenterRecord(center) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /centers/{id}:
   *   delete:
   *     summary: حذف سنتر (soft delete)
   *     description: يتم تفعيل isDeleted=true بدلاً من حذف السجل نهائياً.
   *     tags: [Centers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: رقم السنتر
   *     responses:
   *       200:
   *         description: تم حذف السنتر (soft delete)
   *       404:
   *         description: السنتر غير موجود
   */
  // DELETE /centers/:id
  router.delete(
    "/:id",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const center = await CenterModel.findOne({
          where: { id, isDeleted: false },
        });
        if (!center)
          return res
            .status(404)
            .json({ success: false, message: "السنتر غير موجود" });

        await center.update({ isDeleted: true, updatedAtLocal: new Date() });

        res.json({ success: true, message: "تم حذف السنتر (soft delete)" });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
