// src/routes/notifications.routes.js
import { Router } from "express";
import { Op, Sequelize } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: إدارة إشعارات الطلاب (قراءة، تعليم كمقروء، بثّ إشعارات، وحذف إداري).
 *
 * components:
 *   schemas:
 *     NotificationItem:
 *       type: object
 *       description: تمثيل إشعار كما يراه الطالب في الـ Frontend
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         body:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         read:
 *           type: boolean
 *         kind:
 *           type: string
 *           nullable: true
 *         data:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *
 *     NotificationStudentListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NotificationItem'
 *
 *     NotificationAdminItem:
 *       allOf:
 *         - $ref: '#/components/schemas/NotificationItem'
 *         - type: object
 *           properties:
 *             studentId:
 *               type: integer
 *
 *     NotificationAdminListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NotificationAdminItem'
 *         meta:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             pageSize:
 *               type: integer
 *             total:
 *               type: integer
 *             totalPages:
 *               type: integer
 *
 *     NotificationBroadcastRequest:
 *       type: object
 *       description: نموذج بثّ إشعار من الأدمن/المعلم إلى شريحة طلاب معيّنة
 *       required:
 *         - title
 *         - body
 *       properties:
 *         title:
 *           type: string
 *           description: عنوان الإشعار
 *         body:
 *           type: string
 *           description: محتوى الإشعار
 *         studentId:
 *           type: integer
 *           nullable: true
 *           description: إرسال لطالب واحد فقط
 *         studentIds:
 *           type: array
 *           nullable: true
 *           description: قائمة طلاب محددين
 *           items:
 *             type: integer
 *         centerId:
 *           type: integer
 *           nullable: true
 *           description: إرسال لكل طلاب سنتر معيّن
 *         level:
 *           type: string
 *           nullable: true
 *           description: المرحلة/السنة الدراسية (year)
 *         centerCode:
 *           type: string
 *           nullable: true
 *           description: كود سنتر واحد (centerCode في سجل الطالب)
 *         centerCodes:
 *           type: array
 *           nullable: true
 *           description: قائمة أكواد سناتر
 *           items:
 *             type: string
 *         sendToAll:
 *           type: boolean
 *           nullable: true
 *           description: لو true يتم الإرسال لكل الطلاب في المنصة
 *         data:
 *           type: object
 *           nullable: true
 *           description: payload إضافي للـ UI (مثلاً deep-link أو نوع الإشعار)
 *           additionalProperties: true
 *
 *     NotificationBroadcastResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             sentCount:
 *               type: integer
 *               description: عدد الإشعارات التي تم إنشاؤها فعلياً
 *
 *     NotificationBulkDeleteRequest:
 *       type: object
 *       required:
 *         - ids
 *       properties:
 *         ids:
 *           type: array
 *           description: قائمة IDs للإشعارات المطلوب حذفها
 *           items:
 *             type: integer
 *
 *     NotificationBulkDeleteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             deleted:
 *               type: integer
 *             ids:
 *               type: array
 *               items:
 *                 type: integer
 */

function toIsoSafe(value) {
  if (!value && value !== 0) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function createNotificationsRouter(models) {
  const router = Router();

  const NotificationMysql =
    models.NotificationMysql ||
    models.Notification ||
    models.NotificationModel;

  const StudentMysql =
    models.StudentMysql || models.Student || models.StudentModel;

  if (!NotificationMysql) {
    console.error(
      "[NotificationsRouter] Notification model is not configured in models"
    );
  }

  // Helper: نجيب studentId من الـ JWT
  function getCurrentStudentId(req) {
    const u = req.user || {};
    if (u.studentId) return Number(u.studentId);
    if (u.role === "student" && u.id) return Number(u.id);
    return null;
  }

  // ========= 1) إشعارات الطالب الحالي =========
  // GET /notifications

  /**
   * @swagger
   * /notifications:
   *   get:
   *     summary: استرجاع إشعارات الطالب الحالي
   *     description: يرجع آخر 200 إشعار للطالب الحالي مرتبة تنازلياً حسب تاريخ الإنشاء.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة إشعارات الطالب
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationStudentListResponse'
   *       403:
   *         description: لا يوجد طالب مرتبط بالحساب الحالي
   *       500:
   *         description: خطأ في السيرفر أو عدم تهيئة الموديل
   */
  router.get("/", requireAuth, async (req, res, next) => {
    try {
      if (!NotificationMysql) {
        return res.status(500).json({
          success: false,
          message: "Notification model is not configured",
        });
      }

      const studentId = getCurrentStudentId(req);
      if (!studentId) {
        return res.status(403).json({
          success: false,
          message: "لا يوجد طالب مرتبط بالحساب الحالي",
        });
      }

      const notifs = await NotificationMysql.findAll({
        where: { studentId },
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"],
        ],
        limit: 200,
      });

      const data = notifs.map((n) => {
        const raw = n.toJSON ? n.toJSON() : n;

        const dateIso =
          toIsoSafe(raw.createdAt) ||
          toIsoSafe(raw.updatedAtLocal) ||
          toIsoSafe(raw.updatedAt) ||
          null;

        const extraData =
          raw.dataJson ??
          raw.data ??
          raw.meta ??
          null;

        return {
          id: raw.id,
          title: raw.title,
          body: raw.body,
          date: dateIso,
          read: !!raw.isRead,
          kind: raw.kind || null,
          data: extraData,
        };
      });

      return res.json({ success: true, data });
    } catch (e) {
      console.error("Error in GET /notifications", e);
      next(e);
    }
  });

  // ========= 2) تعليم واحد كمقروء =========
  // POST /notifications/:id/read

  /**
   * @swagger
   * /notifications/{id}/read:
   *   post:
   *     summary: تعليم إشعار واحد كمقروء للطالب الحالي
   *     description: يعلّم إشعار محدد كمقروء مع التأكد أنه مملوك لنفس الطالب.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الإشعار
   *     responses:
   *       200:
   *         description: تم التعليم كمقروء بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *       400:
   *         description: معرّف الإشعار غير صالح
   *       403:
   *         description: لا يوجد طالب مرتبط بالحساب الحالي
   *       404:
   *         description: الإشعار غير موجود أو لا يخص الطالب
   *       500:
   *         description: خطأ في السيرفر
   */
  router.post("/:id/read", requireAuth, async (req, res, next) => {
    try {
      if (!NotificationMysql) {
        return res.status(500).json({
          success: false,
          message: "Notification model is not configured",
        });
      }

      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "معرّف الإشعار غير صالح",
        });
      }

      const studentId = getCurrentStudentId(req);
      if (!studentId) {
        return res.status(403).json({
          success: false,
          message: "لا يوجد طالب مرتبط بالحساب الحالي",
        });
      }

      const notif = await NotificationMysql.findOne({
        where: { id, studentId },
      });

      if (!notif) {
        return res.status(404).json({
          success: false,
          message: "الإشعار غير موجود",
        });
      }

      await notif.update({ isRead: true, updatedAtLocal: new Date() });

      return res.json({ success: true });
    } catch (e) {
      console.error("Error in POST /notifications/:id/read", e);
      next(e);
    }
  });

  // ========= 3) تعليم الكل كمقروء =========
  // POST /notifications/mark-all-read

  /**
   * @swagger
   * /notifications/mark-all-read:
   *   post:
   *     summary: تعليم جميع إشعارات الطالب الحالي كمقروءة
   *     description: يقوم بتحديث كل إشعارات الطالب الحالي بحيث تصبح isRead = true.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: تم التعليم للجميع كمقروء
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *       403:
   *         description: لا يوجد طالب مرتبط بالحساب الحالي
   *       500:
   *         description: خطأ في السيرفر
   */
  router.post("/mark-all-read", requireAuth, async (req, res, next) => {
    try {
      if (!NotificationMysql) {
        return res.status(500).json({
          success: false,
          message: "Notification model is not configured",
        });
      }

      const studentId = getCurrentStudentId(req);
      if (!studentId) {
        return res.status(403).json({
          success: false,
          message: "لا يوجد طالب مرتبط بالحساب الحالي",
        });
      }

      await NotificationMysql.update(
        { isRead: true, updatedAtLocal: new Date() },
        { where: { studentId, isRead: false } }
      );

      return res.json({ success: true });
    } catch (e) {
      console.error("Error in POST /notifications/mark-all-read", e);
      next(e);
    }
  });

  // ========= 4) Admin/Teacher Broadcast =========
  // POST /notifications/admin/broadcast

  /**
   * @swagger
   * /notifications/admin/broadcast:
   *   post:
   *     summary: بثّ إشعار من الأدمن/المعلم لشريحة من الطلاب
   *     description: |
   *       يتيح للأدمن أو المعلم إنشاء إشعارات متعددة لطلاب معيّنين أو سنتر معين أو شريحة حسب year أو لجميع الطلاب.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/NotificationBroadcastRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء الإشعارات وبثها إلى الطلاب المستهدفين
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationBroadcastResponse'
   *       400:
   *         description: بيانات ناقصة (title/body) أو لا يوجد طلاب مستهدفون
   *       403:
   *         description: صلاحيات غير كافية (يتطلب admin أو teacher)
   *       500:
   *         description: خطأ في السيرفر
   */
  router.post(
    "/admin/broadcast",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        if (!NotificationMysql) {
          return res.status(500).json({
            success: false,
            message: "Notification model is not configured",
          });
        }

        const {
          title,
          body,
          studentId,
          studentIds,
          centerId,
          level,          // year
          centerCode,     // single student centerCode
          centerCodes,    // array of centerCodes
          sendToAll,
          data,           // payload إضافي للـ UI
        } = req.body || {};

        const titleStr = String(title || "").trim();
        const bodyStr = String(body || "").trim();

        if (!titleStr || !bodyStr) {
          return res.status(400).json({
            success: false,
            message: "title و body مطلوبة",
          });
        }

        const targetIds = new Set();

        // 4.1 إرسال لكل الطلاب
        if (sendToAll && StudentMysql) {
          const allStudents = await StudentMysql.findAll({
            attributes: ["id"],
          });
          allStudents.forEach((s) => {
            if (s && s.id != null) {
              targetIds.add(Number(s.id));
            }
          });
        }

        // 4.2 طالب واحد أو قائمة studentIds
        if (studentId) {
          const idNum = Number(studentId);
          if (Number.isFinite(idNum) && idNum > 0) {
            targetIds.add(idNum);
          }
        }

        if (Array.isArray(studentIds)) {
          studentIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
            .forEach((id) => targetIds.add(id));
        }

        // 4.3 طلاب بأكواد السنتر centerCode(s)
        if (StudentMysql) {
          const codesSet = new Set();

          if (centerCode) {
            const c = String(centerCode).trim();
            if (c) codesSet.add(c);
          }

          if (Array.isArray(centerCodes)) {
            centerCodes
              .map((c) => String(c || "").trim())
              .filter((c) => !!c)
              .forEach((c) => codesSet.add(c));
          }

          if (codesSet.size) {
            const codesArr = Array.from(codesSet);
            const where = {
              centerCode: { [Op.in]: codesArr },
            };
            if (level) {
              where.year = String(level);
            }

            const students = await StudentMysql.findAll({
              where,
              attributes: ["id"],
            });
            students.forEach((s) => {
              if (s && s.id != null) {
                targetIds.add(Number(s.id));
              }
            });
          }
        }

        // 4.4 فلترة بالسنتر / المرحلة (centerId, level)
        if ((centerId || level) && StudentMysql) {
          const where = {};
          if (centerId) where.centerId = Number(centerId);
          if (level) where.year = String(level);

          const students = await StudentMysql.findAll({
            where,
            attributes: ["id"],
          });
          students.forEach((s) => {
            if (s && s.id != null) {
              targetIds.add(Number(s.id));
            }
          });
        }

        if (!targetIds.size) {
          return res.status(400).json({
            success: false,
            message: "لا يوجد طلاب مستهدفين للإشعار",
          });
        }

        const now = new Date();
        const payloadJson =
          data && typeof data === "object" ? data : null;
        let sentCount = 0;

        for (const sid of targetIds) {
          await NotificationMysql.create({
            studentId: sid,
            title: titleStr,
            body: bodyStr,
            kind: "GENERAL",
            dataJson: payloadJson,
            isRead: false,
            createdAt: now,
            updatedAtLocal: now,
          });
          sentCount++;
        }

        return res.json({
          success: true,
          data: { sentCount },
        });
      } catch (e) {
        console.error("Error in POST /notifications/admin/broadcast", e);
        next(e);
      }
    }
  );

  // ========= 5.0) (إداري) قائمة الإشعارات المجمعة =========
  // GET /notifications/admin/batches
  router.get(
    "/admin/batches",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        if (!NotificationMysql) {
          return res.status(500).json({
            success: false,
            message: "Notification model is not configured",
          });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(req.query.pageSize) || 20)
        );
        const offset = (page - 1) * pageSize;

        // Group by title, body, createdAt to form "batches"
        const { count, rows } = await NotificationMysql.findAndCountAll({
          attributes: [
            'title',
            'body',
            'kind',
            'createdAt',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'targetCount'],
            [Sequelize.fn('MAX', Sequelize.col('id')), 'maxId']
          ],
          group: ['title', 'body', 'createdAt', 'kind'],
          order: [['createdAt', 'DESC']],
          offset,
          limit: pageSize,
        });

        // 'count' is an array of objects when using GROUP BY in findAndCountAll
        const total = Array.isArray(count) ? count.length : count;

        const data = rows.map((r) => {
          const raw = r.toJSON ? r.toJSON() : r;
          return {
            batchId: new Date(raw.createdAt).toISOString(),
            title: raw.title,
            body: raw.body,
            kind: raw.kind || null,
            date: new Date(raw.createdAt).toISOString(),
            targetCount: Number(raw.targetCount) || 0,
          };
        });

        return res.json({
          success: true,
          data,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        });
      } catch (e) {
        console.error("Error in GET /notifications/admin/batches", e);
        next(e);
      }
    }
  );

  // ========= 5) (إداري) قائمة كل الإشعارات مع pagination =========
  // GET /notifications/admin?page=1&pageSize=20

  /**
   * @swagger
   * /notifications/admin:
   *   get:
   *     summary: استرجاع قائمة إشعارات الطلاب (عرض إداري)
   *     description: يرجع قائمة بالإشعارات مع بيانات الطالب (studentId) مع دعم الـ pagination.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: رقم الصفحة
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: عدد العناصر في الصفحة
   *       - in: query
   *         name: batchId
   *         schema:
   *           type: string
   *         description: فلترة حسب رقم الدفعة (تاريخ الإنشاء)
   *     responses:
   *       200:
   *         description: قائمة الإشعارات مع بيانات الـ pagination
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationAdminListResponse'
   *       403:
   *         description: صلاحيات غير كافية (يتطلب admin أو teacher)
   *       500:
   *         description: خطأ في السيرفر
   */
  router.get(
    "/admin",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        if (!NotificationMysql) {
          return res.status(500).json({
            success: false,
            message: "Notification model is not configured",
          });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(req.query.pageSize) || 20)
        );
        const offset = (page - 1) * pageSize;

        const where = {};
        if (req.query.batchId) {
           where.createdAt = new Date(String(req.query.batchId));
        }

        const { count, rows } = await NotificationMysql.findAndCountAll({
          where,
          order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
          ],
          offset,
          limit: pageSize,
        });

        const data = rows.map((n) => {
          const raw = n.toJSON ? n.toJSON() : n;

          const dateIso =
            toIsoSafe(raw.createdAt) ||
            toIsoSafe(raw.updatedAtLocal) ||
            toIsoSafe(raw.updatedAt) ||
            null;

          const extraData =
            raw.dataJson ??
            raw.data ??
            raw.meta ??
            null;

          return {
            id: raw.id,
            studentId: Number(raw.studentId),
            title: raw.title,
            body: raw.body,
            date: dateIso,
            read: !!raw.isRead,
            kind: raw.kind || null,
            data: extraData,
          };
        });

        return res.json({
          success: true,
          data,
          meta: {
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize),
          },
        });
      } catch (e) {
        console.error("Error in GET /notifications/admin", e);
        next(e);
      }
    }
  );

  // ========= 6) حذف إشعار واحد (Admin) =========
  // DELETE /notifications/admin/:id

  /**
   * @swagger
   * /notifications/admin/{id}:
   *   delete:
   *     summary: حذف إشعار واحد (عرض إداري)
   *     description: يحذف إشعارًا واحدًا من قاعدة البيانات (حذف فعلي).
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الإشعار
   *     responses:
   *       200:
   *         description: تم حذف الإشعار بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *       400:
   *         description: معرّف الإشعار غير صالح
   *       403:
   *         description: صلاحيات غير كافية
   *       404:
   *         description: الإشعار غير موجود أو محذوف مسبقاً
   *       500:
   *         description: خطأ في السيرفر
   */
  router.delete(
    "/admin/:id",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        if (!NotificationMysql) {
          return res.status(500).json({
            success: false,
            message: "Notification model is not configured",
          });
        }

        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "معرّف الإشعار غير صالح",
          });
        }

        const deleted = await NotificationMysql.destroy({ where: { id } });

        if (!deleted) {
          return res.status(404).json({
            success: false,
            message: "الإشعار غير موجود أو تم حذفه مسبقاً",
          });
        }

        return res.json({ success: true });
      } catch (e) {
        console.error("Error in DELETE /notifications/admin/:id", e);
        next(e);
      }
    }
  );

  // ========= 7) حذف مجموعة إشعارات (Admin bulk) =========
  // DELETE /notifications/admin   body: { ids: number[] }

  /**
   * @swagger
   * /notifications/admin:
   *   delete:
   *     summary: حذف مجموعة إشعارات (حذف جماعي)
   *     description: يحذف مجموعة من الإشعارات باستخدام قائمة IDs.
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/NotificationBulkDeleteRequest'
   *     responses:
   *       200:
   *         description: تم تنفيذ الحذف الجماعي
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationBulkDeleteResponse'
   *       400:
   *         description: لم يتم إرسال مصفوفة ids صحيحة
   *       403:
   *         description: صلاحيات غير كافية
   *       500:
   *         description: خطأ في السيرفر
   */
  router.delete(
    "/admin",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        if (!NotificationMysql) {
          return res.status(500).json({
            success: false,
            message: "Notification model is not configured",
          });
        }

        const idsRaw = (req.body && req.body.ids) || [];
        const ids = Array.isArray(idsRaw)
          ? idsRaw
              .map((x) => Number(x))
              .filter((x) => Number.isFinite(x) && x > 0)
          : [];

        if (!ids.length) {
          return res.status(400).json({
            success: false,
            message: "يجب إرسال مصفوفة ids للحذف الجماعي",
          });
        }

        const deleted = await NotificationMysql.destroy({
          where: { id: { [Op.in]: ids } },
        });

        return res.json({
          success: true,
          data: { deleted, ids },
        });
      } catch (e) {
        console.error("Error in DELETE /notifications/admin (bulk)", e);
        next(e);
      }
    }
  );

  return router;
}
