// src/routes/courses.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto'; // ⚡ NEW
import { slugify } from '../utils/slug.js';
import { encodeId } from '../utils/hash.js'; // ⚡ NEW
import { isAllowedHost } from '../utils/url-guard.js';
import { ENV } from '../config/env.js'; // ⚡ NEW

// 🔐 Middlewares
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';
import softAuth from '../middlewares/soft-auth.js';
import { checkAppVersion } from '../middlewares/version-check.js'; // ⚡ NEW

// 🔒 Security logic
import { wrapProtectedVideo, generateSessionToken } from '../utils/video-security.js'; // ⚡ NEW

// ⚠️ middlewares سابقة للوصول
import { canAccessCourse, canAccessLesson } from '../middlewares/access.js';

// 🧮 مستويات السنوات الموحّدة في المشروع
import { LEVELS_AR, normalizeLevel } from '../utils/levels.js';

/**
 * @swagger
 * tags:
 *   - name: Courses
 *     description: إدارة الكورسات والدروس وعرضها للطلاب (إنشاء، تعديل، حذف، مشاهدة)
 *
 * components:
 *   schemas:
 *     CourseDto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         slug:
 *           type: string
 *         shortDesc:
 *           type: string
 *           nullable: true
 *         longDesc:
 *           type: string
 *           nullable: true
 *         coverImageUrl:
 *           type: string
 *           nullable: true
 *         trailerUrl:
 *           type: string
 *           nullable: true
 *         teacherName:
 *           type: string
 *           nullable: true
 *         category:
 *           type: string
 *           nullable: true
 *         level:
 *           type: string
 *         isFree:
 *           type: boolean
 *         priceCents:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *         lessonsCount:
 *           type: integer
 *         totalDurationSec:
 *           type: integer
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     LessonDto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         courseId:
 *           type: integer
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         teacherNotes:
 *           type: string
 *           nullable: true
 *         provider:
 *           type: string
 *         streamType:
 *           type: string
 *           description: mp4 | hls | dash | external
 *         videoId:
 *           type: string
 *           nullable: true
 *           description: معرّف الفيديو (لليوتيوب/فيميو)
 *         streamUrl:
 *           type: string
 *           nullable: true
 *           description: للأنواع المحلية فقط
 *         downloadUrl:
 *           type: string
 *           nullable: true
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *         durationSec:
 *           type: integer
 *         isFreePreview:
 *           type: boolean
 *         status:
 *           type: string
 *         orderIndex:
 *           type: integer
 *         linkExpiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         linkVersion:
 *           type: integer
 *
 *     CourseWithLessonsDto:
 *       allOf:
 *         - $ref: '#/components/schemas/CourseDto'
 *         - type: object
 *           properties:
 *             lessons:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LessonDto'
 *
 *     CourseOwnershipDto:
 *       type: object
 *       properties:
 *         owned:
 *           type: boolean
 *         via:
 *           type: string
 *           nullable: true
 *           description: free | enrollment | subscription
 *
 *     CourseListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CourseDto'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *
 *     LessonStreamResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         streamType:
 *           type: string
 *         provider:
 *           type: string
 *           nullable: true
 *         streamUrl:
 *           type: string
 *           nullable: true
 *         videoId:
 *           type: string
 *           nullable: true
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *         via:
 *           type: string
 *           nullable: true
 */

/** ===== Validation ===== */
function validateCourse(b) {
  const errors = [];
  if (!b.title || String(b.title).trim().length < 3)
    errors.push('عنوان الكورس مطلوب (3 أحرف على الأقل)');

  if (b.priceCents !== undefined && Number(b.priceCents) < 0)
    errors.push('السعر غير صالح');

  if (b.level !== undefined) {
    const lv = normalizeLevel(b.level);
    if (!lv)
      errors.push(
        'السنة/المستوى غير صالح. القيم المسموح بها: ' + LEVELS_AR.join(' | ')
      );
  }

  if (
    b.status &&
    !['draft', 'published', 'archived'].includes(String(b.status))
  )
    errors.push('حالة النشر غير صالحة');

  return errors;
}

function validateCloudLesson(b) {
  const errors = [];
  if (!b.title || String(b.title).trim().length < 3)
    errors.push('عنوان الدرس مطلوب (3 أحرف على الأقل)');

  // ✅ نوع الدرس
  if (b.kind !== undefined) {
    const kind = String(b.kind);
    if (!['lesson', 'homework'].includes(kind)) {
      errors.push('نوع الدرس غير صالح');
    }
  }

  // ✅ تفاصيل الواجب
  if (b.kind === 'homework') {
    if (b.dueDate) {
      const dt = new Date(b.dueDate);
      if (Number.isNaN(dt.getTime()))
        errors.push('تاريخ استحقاق الواجب غير صالح');
    }
    if (
      b.hwStatus &&
      !['pending', 'submitted', 'graded'].includes(String(b.hwStatus))
    ) {
      errors.push('حالة الواجب غير صالحة');
    }
  }

  if (b.durationSec !== undefined && Number(b.durationSec) < 0)
    errors.push('المدة غير صالحة');
  if (b.captions && !Array.isArray(b.captions))
    errors.push('captions يجب أن تكون مصفوفة');
  if (b.resources && !Array.isArray(b.resources))
    errors.push('resources يجب أن تكون مصفوفة');
  if (b.linkExpiresAt) {
    const dt = new Date(b.linkExpiresAt);
    if (Number.isNaN(dt.getTime())) errors.push('linkExpiresAt غير صالح');
  }
  if (b.teacherNotes !== undefined && b.teacherNotes !== null && typeof b.teacherNotes !== 'string')
    errors.push('teacherNotes يجب أن تكون نصاً');

  return errors;
}

function safeCourse(c) {
  const json = typeof c?.toJSON === 'function' ? c.toJSON() : c || {};
  return json;
}
function safeLesson(l) {
  const json = typeof l?.toJSON === 'function' ? l.toJSON() : l || {};
  // 🛡️ SECURITY: Never return videoId or streamUrl in lists/details.
  // These should ONLY be provided via the /stream endpoints which have strict guards.
  delete json.videoId;
  delete json.streamUrl;
  delete json.downloadUrl;
  // 🔐 SECURITY: Also hide resources (PDFs) from public lesson listings
  delete json.resources;
  return json;
}

/** ===== Helpers للـ external ===== */
function normalizeExternalUrl(provider, videoId) {
  const p = String(provider || '').toLowerCase();
  if (videoId) {
    const vid = String(videoId).trim();
    if (p === 'youtube') return `https://www.youtube.com/watch?v=${vid}`;
    if (p === 'vimeo') return `https://vimeo.com/${vid}`;
  }
  return null;
}

function extractExternalVideoId(provider, rawUrl) {
  try {
    if (!rawUrl) return null;
    const p = String(provider || '').toLowerCase();
    const u = new URL(rawUrl);

    if (p === 'youtube') {
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '');
      }
      if (u.pathname.includes('/embed/')) {
        return u.pathname.split('/embed/')[1];
      }
      return u.searchParams.get('v');
    }

    if (p === 'vimeo') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/** ===== Helpers للملكية ===== */
function isActive(sub) {
  const now = Date.now();
  const s = sub?.startsAt ? new Date(sub.startsAt).getTime() : 0;
  const e = sub?.endsAt ? new Date(sub.endsAt).getTime() : 0;
  return s <= now && now <= e && sub.status === 'active';
}

function parsePlanCategories(scopeValue) {
  if (!scopeValue) return null;
  try {
    const parsed = JSON.parse(scopeValue);
    if (Array.isArray(parsed)) {
      return parsed.map((c) => String(c).trim()).filter(Boolean);
    }
  } catch {
    const s = String(scopeValue).trim();
    return s ? [s] : null;
  }
  return null;
}

async function computeOwnership({ models, studentId, course }) {
  const {
    EnrollmentMysql,
    Enrollment,
    SubscriptionMysql,
    Subscription,
    PlanMysql,
    Plan,
  } = models;

  const EnrollmentModel =
    EnrollmentMysql || Enrollment || models.EnrollmentMysql || models.Enrollment;
  const SubscriptionModel =
    SubscriptionMysql ||
    Subscription ||
    models.SubscriptionMysql ||
    models.Subscription;
  const PlanModel =
    PlanMysql || Plan || models.PlanMysql || models.Plan;

  if (course.isFree) return { owned: true, via: 'free' };

  // لو مفيش موديلات اشتراك/خطة، نكتفي بالتسجيل المباشر إن وجد
  let enroll = null;
  if (studentId && EnrollmentModel) {
    enroll = await EnrollmentModel.findOne({
      where: { studentId, courseId: course.id },
    });
  }
  if (enroll) {
    const enrEnd = enroll.endsAt ? new Date(enroll.endsAt).getTime() : null;
    if (!enrEnd || enrEnd >= Date.now()) {
      return { owned: true, via: 'enrollment' };
    }
  }

  if (studentId && SubscriptionModel && PlanModel) {
    const subs = await SubscriptionModel.findAll({
      where: { studentId, status: 'active' },
      order: [['id', 'DESC']],
      limit: 10,
    });

    for (const sub of subs) {
      if (!isActive(sub)) continue;
      const plan = await PlanModel.findByPk(sub.planId);
      if (!plan || !plan.isActive) continue;

      const scopeType = String(plan.scopeType || 'ALL').toUpperCase();

      // تأكد أن الباقة مخصصة لنفس السنة الدراسية للكورس، إلا إذا كانت الباقة عامة جداً (بدون scopeStage)
      if (plan.scopeStage && plan.scopeStage !== course.level) {
          continue; // الباقة دي لسنة دراسية تانية، متفتحش الكورس ده
      }

      if (scopeType === 'ALL' || scopeType === 'GRADE') {
        return { owned: true, via: 'subscription' };
      }

      if (scopeType === 'CATEGORY') {
        if (course.category && plan.scopeValue) {
          const cats = parsePlanCategories(plan.scopeValue) || [];
          if (cats.includes(course.category)) {
            return { owned: true, via: 'subscription' };
          }
        }
      }

      if (scopeType === 'COURSE_LIST' && plan.includeCourseIds) {
        try {
          const ids = JSON.parse(plan.includeCourseIds);
          if (Array.isArray(ids) && ids.includes(course.id)) {
            return { owned: true, via: 'subscription' };
          }
        } catch {
          // ignore
        }
      }

      // 💡 LESSON_LIST
      // لو الباقة من نوع LESSON_LIST، ملكية "الكورس بالكامل" بتبقى false.
      // لكن الطالب بيقدر يفتح "دروس معينة" من الكورس من خلال `canAccessLesson`.
      // الـ computeOwnership هنا بتحدد إذا كان يقدر يفتح الكورس كله، فبالتالي هنسيبها تكمل لـ false.
    }
  }

  return { owned: false, via: null };
}

function createCoursesRouter(models) {
  const router = Router();

  const {
    CourseMysql,
    Course,
    LessonMysql,
    Lesson,
    StudentAttendanceMysql,
    StudentAttendance,
    StudentLessonOverrideMysql,
    StudentLessonOverride,
  } = models;

  const CourseModel =
    CourseMysql ||
    Course ||
    models.CourseMysql ||
    models.Course ||
    null;

  const LessonModel =
    LessonMysql ||
    Lesson ||
    models.LessonMysql ||
    models.Lesson ||
    null;

  const StudentAttendanceModel =
    StudentAttendanceMysql ||
    StudentAttendance ||
    models.StudentAttendanceMysql ||
    models.StudentAttendance ||
    null;

  const StudentLessonOverrideModel =
    StudentLessonOverrideMysql ||
    StudentLessonOverride ||
    models.StudentLessonOverrideMysql ||
    models.StudentLessonOverride ||
    null;

  if (!CourseModel) {
    throw new Error(
      'Course model (Course / CourseMysql) is not configured'
    );
  }
  if (!LessonModel) {
    throw new Error(
      'Lesson model (Lesson / LessonMysql) is not configured'
    );
  }
  const requireStaff = [requireAuth, requireRole('admin', 'user')]; // ✅ admin + user
  const requireAdminOnly = [requireAuth, requireRole('admin')];     // (اختياري)


  // ===================================================================
  // 🛠️ أولًا: Routes الأدمن (إدارة الكورسات والدروس)
  // ===================================================================

  /**
   * @swagger
   * /courses:
   *   post:
   *     summary: إنشاء كورس جديد
   *     description: إنشاء كورس جديد بواسطة الأدمن.
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CourseDto'
   *     responses:
   *       200:
   *         description: تم إنشاء الكورس
   *       400:
   *         description: أخطاء تحقق من البيانات
   *       409:
   *         description: Slug مستخدم من قبل
   */
  router.post(
    '/',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const errors = validateCourse(body);
        if (errors.length)
          return res.status(400).json({ success: false, errors });

        const title = String(body.title).trim();
        const slug = slugify(body.slug || title);

        const exists = await CourseModel.findOne({
          where: { slug, isDeleted: false },
        });
        if (exists)
          return res
            .status(409)
            .json({ success: false, message: 'Slug مستخدم من قبل' });

        const levelNorm = normalizeLevel(body.level) || LEVELS_AR[0];

        const data = {
          title,
          slug,
          shortDesc: body.shortDesc ?? null,
          longDesc: body.longDesc ?? null,
          coverImageUrl: body.coverImageUrl ?? null,
          trailerUrl: body.trailerUrl ?? null,
          teacherName: body.teacherName ?? null,
          category: body.category ?? null,
          level: levelNorm,
          isFree: body.isFree ?? true,
          priceCents: Number(body.priceCents ?? 0),
          status: body.status ?? 'draft',
          publishedAt: body.status === 'published' ? new Date() : null,
          totalDurationSec: 0,
          lessonsCount: 0,
          updatedAtLocal: new Date(),
        };

        const created = await CourseModel.create(data);

        return res.json({ success: true, data: safeCourse(created) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}:
   *   patch:
   *     summary: تحديث بيانات كورس
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CourseDto'
   *     responses:
   *       200:
   *         description: تم تحديث الكورس
   *       400:
   *         description: بيانات غير صالحة
   *       404:
   *         description: الكورس غير موجود
   *       409:
   *         description: Slug مستخدم من قبل
   */
  router.patch(
    '/:courseId',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.courseId);
        if (!id)
          return res
            .status(400)
            .json({ success: false, message: 'courseId غير صالح' });

        const body = req.body || {};
        const existing = await CourseModel.findByPk(id);
        if (!existing || existing.isDeleted)
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });

        const patch = { updatedAtLocal: new Date() };

        if (body.title) patch.title = String(body.title).trim();

        if (body.slug) {
          const slug = slugify(body.slug);
          const conflict = await CourseModel.findOne({
            where: { slug, id: { [Op.ne]: id }, isDeleted: false },
          });
          if (conflict)
            return res
              .status(409)
              .json({ success: false, message: 'Slug مستخدم من قبل' });
          patch.slug = slug;
        }

        [
          'shortDesc',
          'longDesc',
          'coverImageUrl',
          'trailerUrl',
          'teacherName',
          'category',
        ].forEach((k) => {
          if (body[k] !== undefined) patch[k] = body[k];
        });

        if (body.level !== undefined) {
          const lv = normalizeLevel(body.level);
          if (!lv)
            return res.status(400).json({
              success: false,
              message: 'السنة/المستوى غير صالح',
              allowed: LEVELS_AR,
            });
          patch.level = lv;
        }

        if (body.isFree !== undefined) patch.isFree = !!body.isFree;
        if (body.priceCents !== undefined)
          patch.priceCents = Number(body.priceCents);

        if (body.status) {
          patch.status = body.status;
          patch.publishedAt =
            body.status === 'published'
              ? existing.publishedAt || new Date()
              : null;
        }

        await CourseModel.update(patch, { where: { id } });

        return res.json({
          success: true,
          data: { ...safeCourse(existing), ...patch },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/publish:
   *   post:
   *     summary: نشر كورس
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم النشر
   *       400:
   *         description: courseId غير صالح
   *       404:
   *         description: الكورس غير موجود
   */
  router.post(
    '/:courseId/publish',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.courseId);
        if (!id)
          return res
            .status(400)
            .json({ success: false, message: 'courseId غير صالح' });

        const existing = await CourseModel.findByPk(id);
        if (!existing || existing.isDeleted)
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });

        const patch = {
          status: 'published',
          publishedAt: new Date(),
          updatedAtLocal: new Date(),
        };

        await CourseModel.update(patch, { where: { id } });

        res.json({
          success: true,
          message: 'تم النشر',
          data: { id, ...patch },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/unpublish:
   *   post:
   *     summary: إلغاء نشر كورس
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم إلغاء النشر
   *       400:
   *         description: courseId غير صالح
   *       404:
   *         description: الكورس غير موجود
   */
  router.post(
    '/:courseId/unpublish',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.courseId);
        if (!id)
          return res
            .status(400)
            .json({ success: false, message: 'courseId غير صالح' });

        const existing = await CourseModel.findByPk(id);
        if (!existing || existing.isDeleted)
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });

        const patch = {
          status: 'draft',
          publishedAt: null,
          updatedAtLocal: new Date(),
        };

        await CourseModel.update(patch, { where: { id } });

        res.json({
          success: true,
          message: 'تم إلغاء النشر',
          data: { id, ...patch },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}:
   *   delete:
   *     summary: حذف كورس نهائيًا
   *     description: حذف الكورس وكل دروسه من قاعدة البيانات (hard delete).
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم حذف الكورس نهائيًا
   *       400:
   *         description: courseId غير صالح
   *       404:
   *         description: الكورس غير موجود
   */
  router.delete(
    '/:courseId',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.courseId);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: 'courseId غير صالح' });
        }

        const existing = await CourseModel.findByPk(id);
        if (!existing) {
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });
        }

        // 1️⃣ امسح كل الدروس المرتبطة بالكورس
        await LessonModel.destroy({ where: { courseId: id } });

        // 2️⃣ امسح الكورس نفسه
        await CourseModel.destroy({ where: { id } });

        return res.json({
          success: true,
          message: 'تم حذف الكورس نهائيًا',
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/lessons:
   *   post:
   *     summary: إضافة درس جديد لكورس
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LessonDto'
   *     responses:
   *       200:
   *         description: تم إنشاء الدرس
   *       400:
   *         description: بيانات غير صالحة
   *       404:
   *         description: الكورس غير موجود
   */
  router.post(
    '/:courseId/lessons',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const courseId = Number(req.params.courseId);
        if (!courseId)
          return res
            .status(400)
            .json({ success: false, message: 'courseId غير صالح' });

        const course = await CourseModel.findOne({
          where: { id: courseId, isDeleted: false },
        });
        if (!course)
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });

        const body = req.body || {};
        const errors = validateCloudLesson(body);
        if (errors.length)
          return res.status(400).json({ success: false, errors });

        // ✅ kind + واجب
        const kind =
          body.kind && ['lesson', 'homework'].includes(String(body.kind))
            ? String(body.kind)
            : 'lesson';

        const dueDate =
          kind === 'homework' && body.dueDate
            ? new Date(body.dueDate)
            : null;

        const hwStatus =
          kind === 'homework' && body.hwStatus
            ? String(body.hwStatus)
            : kind === 'homework'
              ? 'pending'
              : null;

        // ترتيب داخل الكورس
        let orderIndex;
        if (body.orderIndex !== undefined && body.orderIndex !== null) {
          orderIndex = Number(body.orderIndex) || 1;
        } else {
          const maxOrder = await LessonModel.max('orderIndex', {
            where: { courseId, isDeleted: false },
          });
          orderIndex = Number.isFinite(maxOrder)
            ? (Number(maxOrder) || 0) + 1
            : 1;
        }

        const st = String(body.streamType || 'mp4').toLowerCase();
        let provider =
          body.provider ?? process.env.CLOUD_DEFAULT_PROVIDER ?? 'generic';

        let videoId = null;
        let streamUrl = null;

        if (st === 'external') {
          provider = String(provider).toLowerCase();
          videoId = body.videoId ? String(body.videoId).trim() : null;
          streamUrl = normalizeExternalUrl(provider, videoId);
        } else {
          streamUrl = body.streamUrl ? String(body.streamUrl).trim() : null;
        }

        const data = {
          courseId,
          title: String(body.title).trim(),
          description: body.description ?? null,
          teacherNotes: body.teacherNotes ?? null,

          // ✅ نوع الدرس و تفاصيل الواجب
          kind,
          dueDate,
          hwStatus,

          provider,
          streamType: st,
          videoId,
          streamUrl,
          downloadUrl: body.downloadUrl
            ? String(body.downloadUrl).trim()
            : null,
          thumbnailUrl: body.thumbnailUrl ?? null,
          durationSec: Number(body.durationSec ?? 0),
          captions: Array.isArray(body.captions) ? body.captions : null,
          resources: Array.isArray(body.resources) ? body.resources : null,
          isFreePreview: !!body.isFreePreview,
          status: body.status ?? 'draft',
          orderIndex,
          linkExpiresAt: body.linkExpiresAt
            ? new Date(body.linkExpiresAt)
            : null,
          linkVersion: Number(body.linkVersion ?? 1),
          updatedAtLocal: new Date(),
        };

        const created = await LessonModel.create(data);

        await CourseModel.update(
          {
            lessonsCount: (course.lessonsCount || 0) + 1,
            totalDurationSec:
              (course.totalDurationSec || 0) + (data.durationSec || 0),
            updatedAtLocal: new Date(),
          },
          { where: { id: courseId } }
        );

        res.json({ success: true, data: safeLesson(created) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/lessons/{lessonId}:
   *   patch:
   *     summary: تعديل بيانات درس
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LessonDto'
   *     responses:
   *       200:
   *         description: تم التعديل
   *       400:
   *         description: معرّفات أو بيانات غير صالحة
   *       404:
   *         description: الدرس غير موجود
   */
  router.patch(
    '/:courseId/lessons/:lessonId',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const courseId = Number(req.params.courseId);
        const lessonId = Number(req.params.lessonId);
        if (!courseId || !lessonId)
          return res
            .status(400)
            .json({ success: false, message: 'معرّفات غير صالحة' });

        const lesson = await LessonModel.findOne({
          where: { id: lessonId, courseId, isDeleted: false },
        });
        if (!lesson)
          return res
            .status(404)
            .json({ success: false, message: 'الدرس غير موجود' });

        const body = req.body || {};

        const errors = validateCloudLesson({
          ...lesson.toJSON(),
          ...body,
          streamUrl: body.streamUrl ?? lesson.streamUrl,
        });
        if (errors.length)
          return res.status(400).json({ success: false, errors });

        const patch = { updatedAtLocal: new Date() };

        // حقول بسيطة
        [
          'title',
          'description',
          'teacherNotes',
          'provider',
          'streamType',
          'streamUrl',
          'downloadUrl',
          'thumbnailUrl',
          'status',
          'kind',
          'hwStatus',
          'orderIndex',
        ].forEach((k) => {
          if (body[k] !== undefined) patch[k] = body[k];
        });

        // dueDate كـ Date
        if (body.dueDate !== undefined) {
          patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
        }

        // ⚡ videoId للـ external
        if (body.videoId !== undefined) {
          patch.videoId = body.videoId ? String(body.videoId).trim() : null;
        }

        if (
          (body.streamType &&
            String(body.streamType).toLowerCase() === 'external') ||
          lesson.streamType === 'external'
        ) {
          const prov = String(
            body.provider ?? lesson.provider ?? 'youtube'
          ).toLowerCase();

          const videoIdToUse =
            body.videoId !== undefined ? body.videoId : lesson.videoId;

          if (videoIdToUse) {
            patch.provider = prov;
            patch.streamType = 'external';
            patch.streamUrl = normalizeExternalUrl(prov, videoIdToUse);
            patch.videoId = videoIdToUse;
          }
        }

        if (body.durationSec !== undefined)
          patch.durationSec = Number(body.durationSec);

        if (body.isFreePreview !== undefined)
          patch.isFreePreview = !!body.isFreePreview;

        if (body.captions !== undefined)
          patch.captions = Array.isArray(body.captions)
            ? body.captions
            : null;

        if (body.resources !== undefined)
          patch.resources = Array.isArray(body.resources)
            ? body.resources
            : null;

        if (body.linkExpiresAt !== undefined)
          patch.linkExpiresAt = body.linkExpiresAt
            ? new Date(body.linkExpiresAt)
            : null;

        if (body.linkVersion !== undefined)
          patch.linkVersion = Number(body.linkVersion);

        // تحديث إجمالي مدة الكورس لو المدة اتغيرت
        if (
          patch.durationSec !== undefined &&
          Number(patch.durationSec) !== (lesson.durationSec || 0)
        ) {
          const diff =
            Number(patch.durationSec) - (lesson.durationSec || 0);
          const course = await CourseModel.findByPk(courseId);
          if (course) {
            await CourseModel.update(
              {
                totalDurationSec:
                  (course.totalDurationSec || 0) + diff,
                updatedAtLocal: new Date(),
              },
              { where: { id: courseId } }
            );
          }
        }

        await LessonModel.update(patch, { where: { id: lessonId } });

        res.json({ success: true, data: { id: lessonId, ...patch } });
      } catch (e) {
        next(e);
      }
    }
  );


  /**
   * @swagger
   * /courses/{courseId}/lessons/{lessonId}:
   *   delete:
   *     summary: حذف درس (Soft delete)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم حذف الدرس (soft delete)
   *       400:
   *         description: معرّفات غير صالحة
   *       404:
   *         description: الدرس غير موجود
   */
  router.delete(
    '/:courseId/lessons/:lessonId',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const courseId = Number(req.params.courseId);
        const lessonId = Number(req.params.lessonId);
        if (!courseId || !lessonId) {
          return res
            .status(400)
            .json({ success: false, message: 'معرّفات غير صالحة' });
        }

        const lesson = await LessonModel.findOne({
          where: { id: lessonId, courseId, isDeleted: false },
        });
        if (!lesson) {
          return res
            .status(404)
            .json({ success: false, message: 'الدرس غير موجود' });
        }

        await LessonModel.update(
          { isDeleted: true, updatedAtLocal: new Date() },
          { where: { id: lessonId } }
        );

        return res.json({
          success: true,
          message: 'تم حذف الدرس (soft delete)',
          data: { id: lessonId },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/lessons/{lessonId}/rotate-link:
   *   post:
   *     summary: تدوير رابط فيديو الدرس (تحديث streamUrl أو تاريخ الانتهاء)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               streamUrl:
   *                 type: string
   *               linkExpiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: تم تدوير الرابط
   *       400:
   *         description: معرّفات أو دومين غير صالح
   *       404:
   *         description: الدرس غير موجود
   */
  router.post(
    '/:courseId/lessons/:lessonId/rotate-link',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const courseId = Number(req.params.courseId);
        const lessonId = Number(req.params.lessonId);
        if (!courseId || !lessonId)
          return res
            .status(400)
            .json({ success: false, message: 'معرّفات غير صالحة' });

        const lesson = await LessonModel.findOne({
          where: { id: lessonId, courseId, isDeleted: false },
        });
        if (!lesson)
          return res
            .status(404)
            .json({ success: false, message: 'الدرس غير موجود' });

        const newUrl = String(req.body?.streamUrl || '').trim();
        const newExpiry = req.body?.linkExpiresAt
          ? new Date(req.body.linkExpiresAt)
          : null;

        if (
          newUrl &&
          lesson.streamType !== 'external' &&
          !isAllowedHost(newUrl)
        ) {
          return res
            .status(400)
            .json({ success: false, message: 'دومين غير مسموح' });
        }

        const patch = {
          updatedAtLocal: new Date(),
          linkVersion: (lesson.linkVersion || 1) + 1,
        };
        if (newUrl) patch.streamUrl = newUrl;
        if (req.body?.linkExpiresAt !== undefined)
          patch.linkExpiresAt = newExpiry;

        await LessonModel.update(patch, { where: { id: lessonId } });

        res.json({
          success: true,
          message: 'تم تدوير الرابط',
          data: { id: lessonId, ...patch },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // ===================================================================
  // 🎓 ثانيًا: Routes الطلاب / العامة (عرض الكورسات و المشاهدة)
  // ===================================================================

  /**
   * @swagger
   * /courses:
   *   get:
   *     summary: قائمة الكورسات (مع إمكانية إرجاع حالة الملكية للطالب)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: بحث في العنوان / الوصف المختصر / اسم المدرّس
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *       - in: query
   *         name: includeOwnership
   *         schema:
   *           type: string
   *           description: 1/true → إرجاع حقل ownership لكل كورس لو المستخدم طالب
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: قائمة الكورسات
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CourseListResponse'
   */
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || '').trim();
      const category = String(req.query.category || '').trim();
      const levelQ = String(req.query.level || '').trim();
      const includeOwnership = ['1', 'true', 'yes'].includes(
        String(req.query.includeOwnership || '').toLowerCase()
      );

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const offset = (page - 1) * limit;

      const where = { isDeleted: false };

      if (q) {
        where[Op.or] = [
          { title: { [Op.like]: `%${q}%` } },
          { shortDesc: { [Op.like]: `%${q}%` } },
          { teacherName: { [Op.like]: `%${q}%` } },
        ];
      }

      if (status) where.status = status;
      if (category) where.category = category;

      if (levelQ) {
        const lv = normalizeLevel(levelQ);
        where.level = lv || levelQ;
      } else if (req.user?.level) {
        const lvUser = normalizeLevel(req.user.level) || req.user.level;
        where.level = lvUser;
      }

      const { rows, count } = await CourseModel.findAndCountAll({
        where,
        order: [['id', 'DESC']],
        limit,
        offset,
      });

      let data = rows.map(r => {
        const c = safeCourse(r);
        return { ...c, secureId: encodeId(c.id) };
      });

      if (includeOwnership && req.user?.id) {
        const studentId = Number(req.user.id);
        const enriched = [];
        for (const c of data) {
          const ownership = await computeOwnership({
            models,
            studentId,
            course: c,
          });
          enriched.push({ ...c, ownership });
        }
        data = enriched;
      }

      res.json({
        success: true,
        data,
        pagination: { page, limit, total: count },
      });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /courses/{courseId}:
   *   get:
   *     summary: تفاصيل كورس واحد مع قائمة الدروس (Playlist)
   *     tags: [Courses]
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم جلب تفاصيل الكورس والدروس
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CourseWithLessonsDto'
   *       400:
   *         description: courseId غير صالح
   *       404:
   *         description: الكورس غير موجود
   */
  router.get('/:courseId', requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.courseId);
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: 'courseId غير صالح' });

      const course = await CourseModel.findOne({
        where: { id, isDeleted: false },
      });
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: 'الكورس غير موجود' });

      const lessons = await LessonModel.findAll({
        where: { courseId: id, isDeleted: false },
        order: [
          ['orderIndex', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      const isStaff = req.user && ['admin', 'user', 'teacher'].includes(req.user.role);

      res.json({
        success: true,
        data: {
          ...safeCourse(course),
          lessons: lessons.map(l => {
            const json = isStaff ? (typeof l.toJSON === 'function' ? l.toJSON() : l || {}) : safeLesson(l);
            
            if (typeof json.resources === 'string') {
               try { json.resources = JSON.parse(json.resources); } catch(e) { json.resources = []; }
            }
            if (typeof json.captions === 'string') {
               try { json.captions = JSON.parse(json.captions); } catch(e) { json.captions = []; }
            }
            
            return json;
          }),
        },
      });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /courses/{id}/ownership:
   *   get:
   *     summary: استعلام ملكية كورس للطالب الحالي
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: حالة الملكية
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CourseOwnershipDto'
   *       400:
   *         description: courseId غير صالح
   *       404:
   *         description: الكورس غير موجود
   */
  router.get('/:id/ownership', requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: 'courseId غير صالح' });

      const course = await CourseModel.findOne({
        where: { id, isDeleted: false },
      });
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: 'الكورس غير موجود' });

      if (!req.user?.id) {
        return res.json({
          success: true,
          data: { owned: !!course.isFree, via: course.isFree ? 'free' : null },
        });
      }

      const ownership = await computeOwnership({
        models,
        studentId: Number(req.user.id),
        course,
      });
      res.json({ success: true, data: ownership });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /courses/{id}/access:
   *   get:
   *     summary: التحقق من وصول الطالب لكورس (حماية API)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: لدى الطالب وصول إلى الكورس
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: لا يملك صلاحية الوصول
   */
  router.get(
    '/:id/access',
    requireAuth,
    checkAppVersion,
    canAccessLesson(models),
    (req, res) => {
      res.json({ success: true, access: req.accessInfo });
    }
  );

  /**
   * @swagger
   * /courses/{courseId}/lessons/{lessonId}/stream:
   *   get:
   *     summary: الحصول على بيانات تشغيل محاضرة (بما في ذلك external/videoId)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: بيانات التشغيل
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LessonStreamResponse'
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: لا يملك صلاحية الوصول أو انتهت الصلاحية
   *       404:
   *         description: المحاضرة غير موجودة
   */
  router.get(
    '/:courseId/lessons/:lessonId/stream',
    requireAuth,
    checkAppVersion, // ⚡ Force update for all streamers
    canAccessLesson(models),
    async (req, res, next) => {
      try {
        const { courseId, lessonId } = req.params;

        const lsn = await LessonModel.findOne({
          where: { id: lessonId, courseId },
        });

        if (!lsn) {
          return res
            .status(404)
            .json({ success: false, message: 'المحاضرة غير موجودة' });
        }

        const via = req.accessInfo?.via;
        const now = new Date();

        // الوصول عن طريق attendance
        if (via === 'attendance' && StudentAttendanceModel) {
          const attendanceId = req.accessInfo.attendanceId;
          const att = await StudentAttendanceModel.findByPk(attendanceId);

          if (!att) {
            return res.status(403).json({
              success: false,
              message: 'انتهت صلاحية الوصول (attendance not found)',
            });
          }

          if (att.accessExpiresAt && new Date(att.accessExpiresAt) < now) {
            return res.status(403).json({
              success: false,
              message: 'انتهت صلاحية الوصول (time)',
            });
          }

          if (att.maxViews != null && att.maxViews >= 0) {
            if ((att.viewsUsed || 0) >= att.maxViews) {
              return res.status(403).json({
                success: false,
                message: 'انتهت صلاحية الوصول (views)',
              });
            }
          }

          const newViewsUsed = (att.viewsUsed || 0) + 1;
          await att.update({
            viewsUsed: newViewsUsed,
            updatedAtLocal: now,
          });
        }

        // الوصول عن طريق override
        if (via === 'override' && StudentLessonOverrideModel) {
          const overrideId = req.accessInfo.overrideId;
          const ov = await StudentLessonOverrideModel.findByPk(overrideId);

          if (!ov) {
            return res.status(403).json({
              success: false,
              message: 'انتهت صلاحية الوصول (override not found)',
            });
          }

          if (ov.expiresAt && new Date(ov.expiresAt) < now) {
            return res.status(403).json({
              success: false,
              message: 'انتهت صلاحية الوصول (time)',
            });
          }

          if (ov.maxViews != null && ov.maxViews >= 0) {
            if ((ov.viewsUsed || 0) >= ov.maxViews) {
              return res.status(403).json({
                success: false,
                message: 'انتهت صلاحية الوصول (views)',
              });
            }
          }

          const newViewsUsed = (ov.viewsUsed || 0) + 1;
          await ov.update({
            viewsUsed: newViewsUsed,
            updatedAtLocal: now,
          });
        }

        // ⚡ التعديل: استخدام videoId مباشرة من الداتابيز للexternal
        if (lsn.streamType === 'external') {
          const provider = String(lsn.provider || 'youtube').toLowerCase();
          const videoId = lsn.videoId;

          // ⚡ NEW: YouTube Video Protection Logic
          if ((provider === 'youtube' || provider === 'vimeo') && ENV.PROTECT_YOUTUBE_VIDEOS) {
            const studentId = req.user?.id || 'guest';
            // Use lessonId from params for token consistency
            const sessionToken = generateSessionToken(studentId, lessonId);
            // Shared secret hash to help player find real video
            const validationKey = crypto.createHash('md5').update(`v-key-${lessonId}`).digest('hex');

            const protectedData = wrapProtectedVideo(videoId, validationKey, sessionToken);

            return res.json({
              success: true,
              streamType: 'external',
              provider,
              videoId: null, // Zero out raw ID for new apps
              ...protectedData,
              thumbnailUrl: lsn.thumbnailUrl,
              via,
            });
          }

          return res.json({
            success: true,
            streamType: 'external',
            provider,
            streamUrl: null, // الفرونت يعتمد على videoId فقط
            videoId: videoId || null, // ⚡ نستخدم videoId مباشرة
            thumbnailUrl: lsn.thumbnailUrl,
            via,
          });
        }

        // باقي الأنواع (mp4 / hls / dash)
        return res.json({
          success: true,
          streamType: lsn.streamType,
          streamUrl: lsn.streamUrl,
          thumbnailUrl: lsn.thumbnailUrl,
          via,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // ================== دروس الكورس ==================
  // GET /api/v1/courses/:courseId/lessons
  router.get('/:courseId/lessons', requireAuth, async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'courseId غير صالح',
        });
      }

      // نشتغل على CourseModel / LessonModel اللى فوق
      if (!LessonModel) {
        return res.status(500).json({
          success: false,
          message: 'نموذج الدروس (Lesson) غير مهيأ',
        });
      }

      const course = await CourseModel.findOne({
        where: { id: courseId, isDeleted: false },
      });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'الكورس غير موجود',
        });
      }

      const lessons = await LessonModel.findAll({
        where: { courseId, isDeleted: false },
        order: [
          ['orderIndex', 'ASC'],
          ['id', 'ASC'],
        ],
        attributes: ['id', 'title', 'orderIndex'],
      });

      return res.json({
        success: true,
        data: lessons,
      });
    } catch (err) {
      console.error('[courses.routes] GET /:courseId/lessons error', err);
      next(err);
    }
  });



  return router;
}

export default createCoursesRouter;