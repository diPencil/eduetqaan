// src/routes/qr-snippets.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';

import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';
import { isAllowedHost } from '../utils/url-guard.js';

const ALLOWED_STREAM_TYPES = ['mp4', 'hls', 'dash', 'external'];

/** =======================
 *  Helpers: model resolver
 *  ======================= */
function candidatesContainers(models) {
  const arr = [models];
  if (models?.mysql) arr.push(models.mysql);
  if (models?.mysqlModels) arr.push(models.mysqlModels);
  if (models?.Mysql) arr.push(models.Mysql);
  if (models?.MySQL) arr.push(models.MySQL);
  if (models?.db?.mysql) arr.push(models.db.mysql);
  return arr.filter(Boolean);
}

function resolveModel(models, names) {
  const containers = candidatesContainers(models);
  for (const container of containers) {
    for (const name of names) {
      if (container?.[name]) return container[name];
    }
  }
  return undefined;
}

function ensureModel(model, label, names) {
  if (model?.findAll || model?.findOne || model?.findByPk) return;
  const hint = Array.isArray(names) ? names.join(' | ') : String(names || '');
  const err = new Error(
    `QrSnippetsRouter: missing model "${label}". Expected one of: ${hint}. ` +
      `Check what you pass into createQrSnippetsRouter(models).`
  );
  err.status = 500;
  throw err;
}

function safeAllowedHost(url) {
  try {
    return isAllowedHost(url);
  } catch {
    return false;
  }
}

function normalizeBool(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function isSoftDeleted(row) {
  // Support common patterns
  return !!(
    row?.isDeleted ||
    row?.is_deleted ||
    row?.deleted ||
    row?.deletedAt ||
    row?.deleted_at
  );
}

function getCourseTitle(c) {
  return (
    c?.title ??
    c?.titleAr ??
    c?.name ??
    c?.nameAr ??
    c?.label ??
    ''
  );
}

function getLessonTitle(l) {
  return (
    l?.title ??
    l?.titleAr ??
    l?.name ??
    l?.nameAr ??
    l?.label ??
    ''
  );
}

function validateQrSnippet(body) {
  const errors = [];

  if (!body.title || String(body.title).trim().length < 3) {
    errors.push('عنوان الكود مطلوب (3 أحرف على الأقل)');
  }
  if (!body.courseId) errors.push('courseId مطلوب');
  if (!body.lessonId) errors.push('lessonId مطلوب');

  const st = String(body.streamType || 'mp4').toLowerCase();
  if (!ALLOWED_STREAM_TYPES.includes(st)) {
    errors.push('streamType غير صالح (mp4 | hls | dash | external)');
  }

  const url = String(body.streamUrl || '').trim();
  if (!url) {
    errors.push('رابط الفيديو (streamUrl) مطلوب');
  } else if (st !== 'external') {
    if (!safeAllowedHost(url)) {
      errors.push('دومين رابط الفيديو غير مسموح (راجع CLOUD_ALLOWED_HOSTS)');
    }
  }

  if (body.posterUrl) {
    const p = String(body.posterUrl).trim();
    if (p && !safeAllowedHost(p)) {
      errors.push('دومين صورة الـ poster غير مسموح');
    }
  }

  if (body.durationSec !== undefined && body.durationSec !== null) {
    const d = Number(body.durationSec);
    if (!Number.isFinite(d) || d < 0) {
      errors.push('durationSec غير صالح');
    }
  }

  if (body.linkExpiresAt) {
    const dt = new Date(body.linkExpiresAt);
    if (Number.isNaN(dt.getTime())) {
      errors.push('linkExpiresAt غير صالح');
    }
  }

  if (body.startAt != null && (Number(body.startAt) < 0 || !Number.isFinite(Number(body.startAt)))) {
    errors.push('startAt غير صالح');
  }
  if (body.endAt != null && (Number(body.endAt) < 0 || !Number.isFinite(Number(body.endAt)))) {
    errors.push('endAt غير صالح');
  }
  if (body.startAt != null && body.endAt != null && Number(body.startAt) >= Number(body.endAt)) {
    errors.push('وقت البدء يجب أن يكون أصغر من وقت النهاية');
  }

  return errors;
}

function safeQrSnippet(q) {
  return typeof q?.toJSON === 'function' ? q.toJSON() : q || {};
}

export function createQrSnippetsRouter(models) {
  const router = Router();

  // Resolve models with flexible naming
  const CourseModel = resolveModel(models, ['CourseMysql', 'CourseMySQL', 'Course', 'CoursesMysql', 'CourseModel']);
  const LessonModel = resolveModel(models, ['LessonMysql', 'LessonMySQL', 'Lesson', 'LessonsMysql', 'LessonModel']);
  const QrSnippetModel = resolveModel(models, ['QrSnippetMysql', 'QrSnippetMySQL', 'QrSnippet', 'QrSnippetsMysql', 'QrSnippetModel']);

  // Fail fast with clear message instead of random 500 TypeError
  ensureModel(CourseModel, 'Course', ['CourseMysql', 'Course']);
  ensureModel(LessonModel, 'Lesson', ['LessonMysql', 'Lesson']);
  ensureModel(QrSnippetModel, 'QrSnippet', ['QrSnippetMysql', 'QrSnippet']);

  /** =========================================
   *  CATALOG
   *  GET /qr-snippets/catalog/courses
   *  GET /qr-snippets/catalog/lessons?courseId=...
   *  ========================================= */
  router.get(
    '/catalog/courses',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const rows = await CourseModel.findAll({
          order: [['id', 'ASC']],
        });

        const data = rows.map((c) => ({
          id: c.id,
          title: getCourseTitle(c),
        }));

        return res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  router.get(
    '/catalog/lessons',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const courseId = Number(req.query.courseId);
        if (!courseId) {
          return res.status(400).json({
            success: false,
            message: 'courseId مطلوب',
          });
        }

        const rows = await LessonModel.findAll({
          where: { courseId },
          order: [['id', 'ASC']],
        });

        const data = rows.map((l) => ({
          id: l.id,
          title: getLessonTitle(l),
          durationSec:
            l?.durationSec != null
              ? Number(l.durationSec)
              : l?.videoDurationSec != null
              ? Number(l.videoDurationSec)
              : l?.duration != null
              ? Number(l.duration)
              : null,
        }));

        return res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /** =========================================
   *  CREATE
   *  POST /qr-snippets
   *  ========================================= */
  router.post(
    '/',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const errors = validateQrSnippet(body);
        if (errors.length) {
          return res.status(400).json({ success: false, errors });
        }

        const courseId = Number(body.courseId);
        const lessonId = Number(body.lessonId);

        const course = await CourseModel.findByPk(courseId);
        if (!course || isSoftDeleted(course)) {
          return res.status(404).json({
            success: false,
            message: 'الكورس غير موجود',
          });
        }

        const lesson = await LessonModel.findByPk(lessonId);
        if (!lesson || isSoftDeleted(lesson)) {
          return res.status(404).json({
            success: false,
            message: 'الدرس غير موجود',
          });
        }

        if (Number(lesson.courseId) !== courseId) {
          return res.status(400).json({
            success: false,
            message: 'الدرس لا ينتمي لهذا الكورس',
          });
        }

        const st = String(body.streamType || 'mp4').toLowerCase();
        const streamUrl = String(body.streamUrl || '').trim();
        const provider = body.provider ? String(body.provider).toLowerCase() : null;

        // token generation / uniqueness
        const rawToken = String(body.token || '').trim();
        let token = rawToken;

        if (!token) {
          token = crypto.randomBytes(10).toString('base64url');
          let tries = 0;
          /* eslint-disable no-await-in-loop */
          while (tries < 7) {
            const exists = await QrSnippetModel.findOne({ where: { token } });
            if (!exists) break;
            token = crypto.randomBytes(10).toString('base64url');
            tries++;
          }
          /* eslint-enable no-await-in-loop */
        } else {
          const exists = await QrSnippetModel.findOne({ where: { token } });
          if (exists) {
            return res.status(409).json({
              success: false,
              message: 'token مستخدم من قبل',
            });
          }
        }

        const now = new Date();

        const data = {
          token,
          courseId,
          lessonId,
          title: String(body.title).trim(),
          description: body.description ?? null,
          subject: body.subject ?? (course?.category || course?.subject || null),
          teacher: body.teacher ?? (course?.teacherName || course?.teacher || null),
          streamType: st,
          provider,
          streamUrl,
          posterUrl: body.posterUrl ? String(body.posterUrl).trim() : null,
          durationSec:
            body.durationSec !== undefined && body.durationSec !== null
              ? Number(body.durationSec)
              : null,
          linkExpiresAt: body.linkExpiresAt ? new Date(body.linkExpiresAt) : null,
          startAt: body.startAt != null ? Number(body.startAt) : 0,
          endAt: body.endAt != null ? Number(body.endAt) : null,
          isActive: body.isActive !== undefined ? !!body.isActive : true,
          createdByUserId: req.user?.id ?? null,
          updatedAtLocal: now,
        };

        const created = await QrSnippetModel.create(data);

        return res.json({
          success: true,
          data: safeQrSnippet(created),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /** =========================================
   *  LIST
   *  GET /qr-snippets
   *  ========================================= */
  router.get(
    '/',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const where = {};
        const q = String(req.query.q || '').trim();

        if (req.query.courseId) {
          const courseId = Number(req.query.courseId);
          if (!courseId) {
            return res.status(400).json({
              success: false,
              message: 'courseId غير صالح',
            });
          }
          where.courseId = courseId;
        }

        if (req.query.lessonId) {
          const lessonId = Number(req.query.lessonId);
          if (!lessonId) {
            return res.status(400).json({
              success: false,
              message: 'lessonId غير صالح',
            });
          }
          where.lessonId = lessonId;
        }

        const activeFilter = normalizeBool(req.query.isActive);
        if (activeFilter !== undefined) {
          where.isActive = activeFilter;
        }

        if (q) {
          where[Op.or] = [
            { title: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
            { token: { [Op.like]: `%${q}%` } },
          ];
        }

        const rows = await QrSnippetModel.findAll({
          where,
          order: [['id', 'DESC']],
        });

        return res.json({
          success: true,
          data: rows.map(safeQrSnippet),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /** =========================================
   *  GET ONE
   *  GET /qr-snippets/:id
   *  ========================================= */
  router.get(
    '/:id',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'id غير صالح',
          });
        }

        const qr = await QrSnippetModel.findByPk(id);
        if (!qr) {
          return res.status(404).json({
            success: false,
            message: 'الكود غير موجود',
          });
        }

        return res.json({
          success: true,
          data: safeQrSnippet(qr),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /** =========================================
   *  UPDATE
   *  PATCH /qr-snippets/:id
   *  ========================================= */
  router.patch(
    '/:id',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'id غير صالح',
          });
        }

        const existing = await QrSnippetModel.findByPk(id);
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: 'الكود غير موجود',
          });
        }

        const body = req.body || {};
        const merged = {
          ...safeQrSnippet(existing),
          ...body,
        };

        const errors = validateQrSnippet(merged);
        if (errors.length) {
          return res.status(400).json({ success: false, errors });
        }

        const patch = {};
        const now = new Date();

        const updatableFields = [
          'title',
          'description',
          'subject',
          'teacher',
          'streamType',
          'provider',
          'streamUrl',
          'posterUrl',
          'durationSec',
          'linkExpiresAt',
          'isActive',
          'courseId',
          'lessonId',
          'startAt',
          'endAt',
        ];

        updatableFields.forEach((key) => {
          if (body[key] !== undefined) patch[key] = body[key];
        });

        // token update with uniqueness
        if (body.token !== undefined) {
          const newToken = String(body.token || '').trim();
          if (!newToken) {
            return res.status(400).json({
              success: false,
              message: 'token لا يمكن أن يكون فارغًا',
            });
          }
          if (newToken !== existing.token) {
            const exists = await QrSnippetModel.findOne({
              where: { token: newToken, id: { [Op.ne]: id } },
            });
            if (exists) {
              return res.status(409).json({
                success: false,
                message: 'token مستخدم من قبل',
              });
            }
            patch.token = newToken;
          }
        }

        const finalCourseId =
          patch.courseId !== undefined ? Number(patch.courseId) : Number(existing.courseId);
        const finalLessonId =
          patch.lessonId !== undefined ? Number(patch.lessonId) : Number(existing.lessonId);

        const course = await CourseModel.findByPk(finalCourseId);
        if (!course || isSoftDeleted(course)) {
          return res.status(404).json({
            success: false,
            message: 'الكورس غير موجود',
          });
        }

        const lesson = await LessonModel.findByPk(finalLessonId);
        if (!lesson || isSoftDeleted(lesson)) {
          return res.status(404).json({
            success: false,
            message: 'الدرس غير موجود',
          });
        }

        if (Number(lesson.courseId) !== finalCourseId) {
          return res.status(400).json({
            success: false,
            message: 'الدرس لا ينتمي لهذا الكورس',
          });
        }

        if (patch.durationSec !== undefined && patch.durationSec !== null) {
          patch.durationSec = Number(patch.durationSec);
        }
        if (patch.linkExpiresAt !== undefined) {
          patch.linkExpiresAt = patch.linkExpiresAt ? new Date(patch.linkExpiresAt) : null;
        }
        if (patch.isActive !== undefined) {
          patch.isActive = !!patch.isActive;
        }

        patch.updatedAtLocal = now;

        await existing.update(patch);
        const fresh = await QrSnippetModel.findByPk(id);

        return res.json({
          success: true,
          data: safeQrSnippet(fresh),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /** =========================================
   *  DEACTIVATE (soft)
   *  DELETE /qr-snippets/:id
   *  ========================================= */
  router.delete(
    '/:id',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'id غير صالح',
          });
        }

        const existing = await QrSnippetModel.findByPk(id);
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: 'الكود غير موجود',
          });
        }

        await existing.update({
          isActive: false,
          updatedAtLocal: new Date(),
        });

        return res.json({
          success: true,
          message: 'تم إلغاء تفعيل الكود',
          data: { id, isActive: false },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}

export default createQrSnippetsRouter;
