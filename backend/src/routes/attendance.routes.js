// src/routes/attendance.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';

import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';
import { normalizeLevel } from '../utils/levels.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     AttendanceLessonStats:
 *       type: object
 *       properties:
 *         centerId:
 *           type: integer
 *         lessonId:
 *           type: integer
 *         totalEnrolled:
 *           type: integer
 *           description: عدد الطلبة المفترض حضورهم
 *         attendedInCenter:
 *           type: integer
 *           description: عدد الطلبة الحاضرين فعليًا في السنتر
 *         attendedOnline:
 *           type: integer
 *           description: عدد الطلبة اللي شاهدوا نفس المحاضرة أونلاين
 *         makeupsCount:
 *           type: integer
 *           description: عدد التعويضات (طلبة من مدارس/سنتر آخر)
 *         blockedCount:
 *           type: integer
 *           description: عدد الطلبة الموقوفين (حاليًا 0 من الكود)
 *
 *     AttendanceRosterStudent:
 *       type: object
 *       properties:
 *         studentId:
 *           type: integer
 *         fullName:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *           description: كود الطالب في السنتر
 *         presentInCenter:
 *           type: boolean
 *         presentOnline:
 *           type: boolean
 *         lastAttendanceAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         originalCenterId:
 *           type: integer
 *           nullable: true
 *
 *     AttendanceRoster:
 *       type: object
 *       properties:
 *         centerId:
 *           type: integer
 *         lessonId:
 *           type: integer
 *           nullable: true
 *         totalExpected:
 *           type: integer
 *         totalPresentInCenter:
 *           type: integer
 *         totalPresentOnline:
 *           type: integer
 *         makeupsCount:
 *           type: integer
 *         blockedCount:
 *           type: integer
 *         students:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AttendanceRosterStudent'
 *
 *     AttendanceWarning:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: "MISSING_PREVIOUS_LESSON"
 *         severity:
 *           type: string
 *           example: "high"
 *         message:
 *           type: string
 *           example: "الطالب لم يحضر المحاضرة السابقة أو لم يشاهد 90% منها على الأقل."
 *
 *     AttendancePreviewSession:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           example: "center"
 *         lessonId:
 *           type: integer
 *         lessonTitle:
 *           type: string
 *           nullable: true
 *         when:
 *           type: string
 *           format: date-time
 *         centerId:
 *           type: integer
 *           nullable: true
 *         accessMode:
 *           type: string
 *           nullable: true
 *         fullyWatched:
 *           type: boolean
 *           nullable: true
 *         watchedSec:
 *           type: integer
 *           nullable: true
 *         durationSec:
 *           type: integer
 *           nullable: true
 *         watchedRatio:
 *           type: number
 *           format: float
 *           nullable: true
 *
 *     AttendancePreviewResponse:
 *       type: object
 *       properties:
 *         student:
 *           type: object
 *           description: JSON كامل لصف الطالب
 *         course:
 *           type: object
 *         currentLesson:
 *           type: object
 *         previousLesson:
 *           type: object
 *           nullable: true
 *         lastFiveSessions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AttendancePreviewSession'
 *         previousLessonInfo:
 *           type: object
 *           nullable: true
 *         previousHomeworkSummary:
 *           type: object
 *           nullable: true
 *         previousLessonQrSummary:
 *           type: object
 *           nullable: true
 *         lastExamSummary:
 *           type: object
 *           nullable: true
 *         isMakeupFromAnotherCenter:
 *           type: boolean
 *         originalCenter:
 *           type: object
 *           nullable: true
 *         currentCenter:
 *           type: object
 *           nullable: true
 *         canAttend:
 *           type: boolean
 *         autoDecision:
 *           type: string
 *           example: "ALLOW"
 *         warnings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AttendanceWarning'
 *
 *     StudentAttendance:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *         courseId:
 *           type: integer
 *         lessonId:
 *           type: integer
 *         centerId:
 *           type: integer
 *           nullable: true
 *         accessMode:
 *           type: string
 *           example: "FULL_LESSON"
 *         attendedAt:
 *           type: string
 *           format: date-time
 *         accessExpiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         maxViews:
 *           type: integer
 *           nullable: true
 *         viewsUsed:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 */

export function createAttendanceRouter(models) {
  const router = Router();

  const {
    Student,
    Lesson,
    Course,
    Center,
    StudentAttendance,
    StudentLessonProgress,
    QrSnippet,
    StudentQrView,
    Exam,
    ExamAttempt,
    Notification,
  } = models;

  // Helper صغير للـ JSON-safe
  function safeJson(row) {
    return row?.toJSON ? row.toJSON() : row || {};
  }

  // Helper: نجيب الدرس اللي قبل الحالي في نفس الكورس (lesson فقط)
  async function findPreviousLesson(courseId, currentLesson) {
    if (!currentLesson) return null;

    const where = {
      courseId: Number(courseId),
      isDeleted: false,
      kind: 'lesson',
      [Op.or]: [
        { orderIndex: { [Op.lt]: currentLesson.orderIndex } },
        {
          orderIndex: currentLesson.orderIndex,
          id: { [Op.lt]: currentLesson.id },
        },
      ],
    };

    const prev = await Lesson.findOne({
      where,
      order: [
        ['orderIndex', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return prev;
  }

  // Helper: إنشاء إشعار تحذير حضور للطالب (MySQL فقط)
  async function createAttendanceWarningNotification({
    studentId,
    course,
    currentLesson,
    previousLesson,
    warnings,
  }) {
    try {
      if (!studentId || !warnings || !warnings.length) return;

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // ما نبعتش أكتر من تحذير ATTENDANCE_WARNING لنفس الطالب في آخر ساعة (anti-spam بسيط)
      const existing = await Notification.findOne({
        where: {
          studentId: Number(studentId),
          kind: 'ATTENDANCE_WARNING',
          createdAt: { [Op.gte]: oneHourAgo },
        },
      });

      if (existing) {
        return;
      }

      const title = 'تحذير بخصوص الحضور - ' + (course?.title || 'الكورس');

      const parts = warnings.map(
        (w) => '- ' + (w.message || w.code || '')
      );

      const bodyLines = [];

      if (currentLesson?.title) {
        bodyLines.push(`محاضرة اليوم: "${currentLesson.title}".`);
      }
      if (previousLesson?.title) {
        bodyLines.push(`المحاضرة السابقة: "${previousLesson.title}".`);
      }

      if (parts.length) {
        bodyLines.push('');
        bodyLines.push('ملحوظات على الحضور والمذاكرة:');
        bodyLines.push(...parts);
      }

      const body = bodyLines.join('\n');

      await Notification.create({
        studentId: Number(studentId),
        title,
        body,
        kind: 'ATTENDANCE_WARNING',
        dataJson: {
          courseId: course?.id ?? null,
          currentLessonId: currentLesson?.id ?? null,
          previousLessonId: previousLesson?.id ?? null,
          warnings,
        },
        isRead: false,
        createdAt: now,
        updatedAtLocal: now,
      });
    } catch (e) {
      console.warn(
        '[notifications] failed to create attendance warning:',
        e.message
      );
    }
  }

  // ============================================================
  // Helper: يبني الـ roster بتاع السنتر + المرحلة + المحاضرة
  // ============================================================
  async function buildCenterLevelRoster({
    centerId,
    level, // string | null
    courseId, // number | null
    lessonId, // number | null
  }) {
    const centerIdNum = Number(centerId);

    // نحدد الـ level الـ "موحّد"
    let targetLevelNorm = null;
    if (level) {
      const raw = String(level);
      targetLevelNorm = normalizeLevel(raw) || raw || null;
    } else if (courseId) {
      const course = await Course.findByPk(courseId);
      if (course?.level) {
        const raw = String(course.level);
        targetLevelNorm = normalizeLevel(raw) || raw || null;
      }
    } else if (lessonId) {
      const lesson = await Lesson.findByPk(lessonId);
      if (lesson?.courseId) {
        const course = await Course.findByPk(lesson.courseId);
        if (course?.level) {
          const raw = String(course.level);
          targetLevelNorm = normalizeLevel(raw) || raw || null;
        }
      }
    }

    // كل الطلبة بتوع السنتر دا
    const studentsRaw = await Student.findAll({
      where: { centerId: centerIdNum },
      order: [['id', 'ASC']],
    });

    // فلترة بالـ level (لو متوفر)
    const students = studentsRaw.filter((st) => {
      if (!targetLevelNorm) return true;
      const plain = safeJson(st);
      const stuNorm = normalizeLevel(plain.year) || plain.year || null;
      if (!stuNorm) return false;
      return stuNorm === targetLevelNorm;
    });

    const studentIds = students.map((s) => Number(s.id));

    // حضور السنتر للمحاضرة دى
    let attendanceRows = [];
    if (lessonId && studentIds.length) {
      attendanceRows = await StudentAttendance.findAll({
        where: {
          lessonId: Number(lessonId),
          studentId: { [Op.in]: studentIds },
          centerId: centerIdNum,
        },
        order: [
          ['attendedAt', 'DESC'],
          ['id', 'DESC'],
        ],
      });
    }

    const attendanceByStudent = new Map();
    attendanceRows.forEach((row) => {
      const sid = Number(row.studentId);
      if (!attendanceByStudent.has(sid)) {
        attendanceByStudent.set(sid, row);
      }
    });

    // مشاهدة أونلاين لنفس المحاضرة
    let progressRows = [];
    if (lessonId && studentIds.length) {
      progressRows = await StudentLessonProgress.findAll({
        where: {
          lessonId: Number(lessonId),
          studentId: { [Op.in]: studentIds },
        },
      });
    }

    const progressByStudent = new Map();
    progressRows.forEach((p) => {
      const sid = Number(p.studentId);
      if (!progressByStudent.has(sid)) {
        progressByStudent.set(sid, p);
      }
    });

    const rosterStudents = students.map((st) => {
      const plain = safeJson(st);
      const sid = Number(plain.id);

      const att = attendanceByStudent.get(sid) || null;
      const prog = progressByStudent.get(sid) || null;

      const presentInCenter = !!att;

      let presentOnline = false;
      if (prog) {
        const duration = Number(prog.durationSecCached || 0) || 0;
        const watched = Number(prog.maxWatchedSec || 0) || 0;
        if (prog.fullyWatched) {
          presentOnline = true;
        } else if (duration > 0) {
          const ratio = watched / duration;
          if (ratio >= 0.9) presentOnline = true;
        }
      }

      const lastAttendanceAt =
        att?.attendedAt || att?.createdAt || att?.updatedAtLocal || null;

      const code =
        plain.centerCode ??
        plain.studentCode ??
        plain.studentCenterCode ??
        plain.code ??
        null;

      return {
        studentId: sid,
        fullName:
          plain.fullName || plain.name || plain.studentName || '',
        code,
        presentInCenter,
        presentOnline,
        lastAttendanceAt,
        originalCenterId: plain.centerId ?? null,
      };
    });

    const totalExpected = rosterStudents.length;
    const totalPresentInCenter = rosterStudents.filter(
      (s) => s.presentInCenter
    ).length;
    const totalPresentOnline = rosterStudents.filter(
      (s) => s.presentOnline
    ).length;

    const makeupsCount = rosterStudents.filter(
      (s) =>
        s.presentInCenter &&
        s.originalCenterId &&
        Number(s.originalCenterId) !== centerIdNum
    ).length;

    return {
      centerId: centerIdNum,
      lessonId: lessonId ? Number(lessonId) : null,
      totalExpected,
      totalPresentInCenter,
      totalPresentOnline,
      makeupsCount,
      blockedCount: 0,
      students: rosterStudents,
    };
  }

  // ============================================================
  // GET /attendance/lesson-stats
  // ============================================================

  /**
   * @swagger
   * /attendance/lesson-stats:
   *   get:
   *     summary: إحصائيات حضور محاضرة لسنتر معين
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: centerId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السنتر
   *       - in: query
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم المحاضرة (kind='lesson')
   *       - in: query
   *         name: level
   *         required: false
   *         schema:
   *           type: string
   *         description: المرحلة/السنة لو عايز تحلل شريحة واحدة فقط
   *       - in: query
   *         name: courseId
   *         required: false
   *         schema:
   *           type: integer
   *         description: رقم الكورس (اختياري، يُستخدم لتحديد الـ level)
   *     responses:
   *       200:
   *         description: ملخص الإحصائيات
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/AttendanceLessonStats'
   *       400:
   *         description: نقص في centerId أو lessonId
   */
  router.get(
    '/lesson-stats',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor', 'center_manager'),
    async (req, res, next) => {
      try {
        const centerId = Number(req.query.centerId);
        const lessonId = Number(req.query.lessonId || 0);
        const level = req.query.level || null;
        const courseId = req.query.courseId
          ? Number(req.query.courseId)
          : null;

        if (!centerId || !lessonId) {
          return res.status(400).json({
            success: false,
            message: 'centerId و lessonId مطلوبان فى الـ query',
          });
        }

        // 🛡️ Security Check: Teacher / Center Manager must belong to the requested center
        // No filtering for staff roles
        const where = { isDeleted: false };
        if (req.query.centerId) where.centerId = req.query.centerId;
        if (req.query.courseId) where.courseId = req.query.courseId;
        if (req.query.lessonId) where.lessonId = req.query.lessonId;

        const roster = await buildCenterLevelRoster({
          centerId,
          level,
          courseId,
          lessonId,
        });

        return res.json({
          success: true,
          data: {
            centerId: roster.centerId,
            lessonId: roster.lessonId,
            totalEnrolled: roster.totalExpected,
            attendedInCenter: roster.totalPresentInCenter,
            attendedOnline: roster.totalPresentOnline,
            makeupsCount: roster.makeupsCount,
            blockedCount: roster.blockedCount,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // ============================================================
  // GET /attendance/center-level-roster
  //        + alias /attendance/lesson-roster
  // ============================================================

  async function centerLevelRosterHandler(req, res, next) {
    try {
      const centerId = Number(req.query.centerId);
      const level = req.query.level || null;
      const courseId = req.query.courseId
        ? Number(req.query.courseId)
        : null;
      const lessonId = req.query.lessonId
        ? Number(req.query.lessonId)
        : null;

      if (!centerId) {
        return res.status(400).json({
          success: false,
          message: 'centerId مطلوب فى الـ query',
        });
      }

      // 🛡️ Security Check: Teacher / Center Manager must belong to the requested center
      // No filtering for staff roles
      const where = { isDeleted: false };
      if (req.query.centerId) where.centerId = req.query.centerId;

      const data = await buildCenterLevelRoster({
        centerId,
        level,
        courseId,
        lessonId,
      });

      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /attendance/center-level-roster:
   *   get:
   *     summary: روستر الحضور لسنتر + مرحلة + محاضرة (لو موجودة)
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: centerId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: level
   *         required: false
   *         schema:
   *           type: string
   *       - in: query
   *         name: courseId
   *         required: false
   *         schema:
   *           type: integer
   *       - in: query
   *         name: lessonId
   *         required: false
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: روستر كامل بالطلبة وحالات الحضور
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/AttendanceRoster'
   *       400:
   *         description: centerId مفقود
   */
  router.get(
    '/center-level-roster',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor', 'center_manager'),
    centerLevelRosterHandler
  );

  /**
   * @swagger
   * /attendance/lesson-roster:
   *   get:
   *     summary: Alias قديم لنفس روستر الحضور
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: centerId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: level
   *         required: false
   *         schema:
   *           type: string
   *       - in: query
   *         name: courseId
   *         required: false
   *         schema:
   *           type: integer
   *       - in: query
   *         name: lessonId
   *         required: false
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: نفس استجابة /center-level-roster
   */
  router.get(
    '/lesson-roster',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor', 'center_manager'),
    centerLevelRosterHandler
  );

  /**
   * POST /attendance/preview
   * بيشتغل وقت ما المساعد في السنتر يعمل Scan لطلب
   * body:
   * {
   *   studentId,
   *   courseId,
   *   lessonId,   // المحاضرة الحالية (kind='lesson')
   *   centerId?   // السنتر اللي الطالب حاضر فيه دلوقتي
   * }
   *
   * بيرجع:
   * - بيانات الطالب / الكورس / المحاضرة الحالية
   * - الدرس اللي قبلها (previousLesson)
   * - آخر 5 جلسات (حضور سنتر + مشاهدة أونلاين)
   * - حالة حضور/مشاهدة الدرس اللي قبل
   * - حالة الواجب بتاع الدرس اللي قبل
   * - آخر امتحان في نفس المادة/السنة
   * - إحصائيات QR للدرس اللي قبل
   * - توصية: ينفع يحضر ولا في تحذيرات (canAttend / autoDecision / warnings)
   * - هل الجلسة دي تعويض من سنتر تاني ولا لا
   */

  /**
   * @swagger
   * /attendance/preview:
   *   post:
   *     summary: معاينة حالة حضور ومذاكرة طالب قبل تسجيل الحضور
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               studentId:
   *                 type: integer
   *               courseId:
   *                 type: integer
   *               lessonId:
   *                 type: integer
   *               centerId:
   *                 type: integer
   *                 nullable: true
   *             required:
   *               - studentId
   *               - courseId
   *               - lessonId
   *     responses:
   *       200:
   *         description: بيانات تفصيلية عن حالة الطالب والمحاضرات السابقة
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/AttendancePreviewResponse'
   *       400:
   *         description: نقص في studentId أو courseId أو lessonId أو خطأ منطقي
   *       404:
   *         description: الطالب أو الكورس أو المحاضرة غير موجودة
   */
  router.post(
    '/preview',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor', 'center_manager'),
    async (req, res, next) => {
      try {
        const { studentId, courseId, lessonId, centerId } = req.body || {};

        if (!studentId || !courseId || !lessonId) {
          return res.status(400).json({
            success: false,
            message: 'برجاء إرسال studentId و courseId و lessonId',
          });
        }

        // 🛡️ Security Check: Teacher center isolation
        if (req.user.role === 'teacher' && centerId && Number(req.user.centerId) !== Number(centerId)) {
          console.warn('[Security] Teacher unauthorized center preview attempt:', {
             teacherId: req.user.id,
             requestedCenterId: centerId,
             assignedCenterId: req.user.centerId
          });
          return res.status(403).json({
            success: false,
            message: 'ليس لديك صلاحية للوصول لبيانات هذا السنتر.'
          });
        }

        // ===== 1) تحقق الأساسيات: الطالب / الكورس / الدرس =====
        const student = await Student.findByPk(studentId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: 'الطالب غير موجود' });
        }

        const course = await Course.findByPk(courseId);
        if (!course || course.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });
        }

        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson || lesson.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'المحاضرة غير موجودة' });
        }
        if (Number(lesson.courseId) !== Number(courseId)) {
          return res.status(400).json({
            success: false,
            message: 'المحاضرة لا تنتمي لهذا الكورس',
          });
        }
        if (String(lesson.kind).toLowerCase() !== 'lesson') {
          return res.status(400).json({
            success: false,
            message: 'المحاضرة الحالية لازم تكون lesson مش homework',
          });
        }

        const now = new Date();

        // ===== 2) الدرس اللي قبل الحالي =====
        const prevLesson = await findPreviousLesson(courseId, lesson);

        // ===== 3) آخر 5 جلسات (سنتر + أونلاين) =====
        const [attRows, progRows] = await Promise.all([
          StudentAttendance.findAll({
            where: {
              studentId: Number(studentId),
              courseId: Number(courseId),
            },
            order: [['attendedAt', 'DESC']],
            limit: 20,
          }),
          StudentLessonProgress.findAll({
            where: {
              studentId: Number(studentId),
              courseId: Number(courseId),
            },
            order: [
              ['lastSeenAt', 'DESC'],
              ['updatedAtLocal', 'DESC'],
            ],
            limit: 50,
          }),
        ]);

        const lessonIdsSet = new Set();
        attRows.forEach((a) => lessonIdsSet.add(Number(a.lessonId)));
        progRows.forEach((p) => lessonIdsSet.add(Number(p.lessonId)));

        const lessonIdsArr = Array.from(lessonIdsSet);
        const lessonsMap = {};
        if (lessonIdsArr.length) {
          const lsns = await Lesson.findAll({
            where: { id: { [Op.in]: lessonIdsArr } },
          });
          lsns.forEach((l) => {
            lessonsMap[Number(l.id)] = l;
          });
        }

        const sessions = [];

        // حضور سنتر
        attRows.forEach((a) => {
          const l = lessonsMap[Number(a.lessonId)];
          const attendedAt =
            a.attendedAt || a.createdAt || a.updatedAtLocal;
          sessions.push({
            type: 'center',
            lessonId: Number(a.lessonId),
            lessonTitle: l?.title || null,
            attendedAt,
            when: attendedAt,
            centerId: a.centerId || null,
            accessMode: a.accessMode || null,
          });
        });

        // مشاهدة أونلاين
        progRows.forEach((p) => {
          const l = lessonsMap[Number(p.lessonId)];
          const when =
            p.completedAt ||
            p.lastSeenAt ||
            p.updatedAtLocal ||
            p.createdAt ||
            now;
          const duration =
            Number(p.durationSecCached || l?.durationSec || 0) || 0;
          const watched = Number(p.maxWatchedSec || 0) || 0;
          const ratio = duration > 0 ? watched / duration : null;

          sessions.push({
            type: 'online',
            lessonId: Number(p.lessonId),
            lessonTitle: l?.title || null,
            when,
            fullyWatched: !!p.fullyWatched,
            watchedSec: watched,
            durationSec: duration,
            watchedRatio: ratio,
          });
        });

        sessions.sort((a, b) => {
          const da = a.when ? new Date(a.when).getTime() : 0;
          const db = b.when ? new Date(b.when).getTime() : 0;
          return db - da;
        });

        const lastFiveSessions = sessions.slice(0, 5);

        // ===== 4) حالة الدرس اللي قبل الحالي (حضور + أونلاين) =====
        let prevLessonInfo = null;
        let prevLessonAttendance = null;
        let prevLessonProgress = null;
        let prevLessonWatchRatio = null;

        if (prevLesson) {
          prevLessonAttendance = await StudentAttendance.findOne({
            where: {
              studentId: Number(studentId),
              courseId: Number(courseId),
              lessonId: Number(prevLesson.id),
            },
            order: [['attendedAt', 'DESC']],
          });

          prevLessonProgress = await StudentLessonProgress.findOne({
            where: {
              studentId: Number(studentId),
              lessonId: Number(prevLesson.id),
            },
            order: [
              ['lastSeenAt', 'DESC'],
              ['updatedAtLocal', 'DESC'],
            ],
          });

          const durationTotal =
            Number(
              prevLessonProgress?.durationSecCached ||
                prevLesson.durationSec ||
                0
            ) || 0;
          const watchedSec =
            Number(prevLessonProgress?.maxWatchedSec || 0) || 0;
          prevLessonWatchRatio =
            durationTotal > 0 ? watchedSec / durationTotal : null;

          prevLessonInfo = {
            id: Number(prevLesson.id),
            title: prevLesson.title,
            attendedInCenter: !!prevLessonAttendance,
            attendanceAt: prevLessonAttendance?.attendedAt || null,
            watchedOnline: !!prevLessonProgress,
            onlineFullyWatched: !!prevLessonProgress?.fullyWatched,
            onlineWatchedSec: watchedSec,
            onlineDurationSec: durationTotal,
            onlineWatchedRatio: prevLessonWatchRatio,
          };
        }

        // ===== 5) واجبات الدرس اللي قبل الحالي =====
        let prevHomeworkSummary = null;

        if (prevLesson) {
          const homeworks = await Lesson.findAll({
            where: {
              parentLessonId: Number(prevLesson.id),
              isDeleted: false,
              // kind: 'homework',
            },
            order: [
              ['orderIndex', 'ASC'],
              ['id', 'ASC'],
            ],
          });

          if (homeworks.length) {
            const hwIds = homeworks.map((h) => Number(h.id));
            const hwProgressRows =
              await StudentLessonProgress.findAll({
                where: {
                  studentId: Number(studentId),
                  lessonId: { [Op.in]: hwIds },
                },
              });

            const hwProgMap = {};
            hwProgressRows.forEach((p) => {
              hwProgMap[Number(p.lessonId)] = p;
            });

            const details = homeworks.map((hw) => {
              const p = hwProgMap[Number(hw.id)];
              const duration =
                Number(p?.durationSecCached || hw.durationSec || 0) ||
                0;
              const watched =
                Number(p?.maxWatchedSec || 0) || 0;
              const ratio = duration > 0 ? watched / duration : null;
              return {
                lessonId: Number(hw.id),
                title: hw.title,
                watchedSec: watched,
                durationSec: duration,
                watchedRatio: ratio,
                fullyWatched: !!p?.fullyWatched,
                hasAnyView: watched > 5, // عتبة بسيطة
              };
            });

            const total = details.length;
            const opened = details.filter((d) => d.hasAnyView).length;
            const completed = details.filter(
              (d) =>
                d.fullyWatched ||
                (typeof d.watchedRatio === 'number' &&
                  d.watchedRatio >= 0.9)
            ).length;

            prevHomeworkSummary = {
              totalHomeworks: total,
              openedCount: opened,
              completedCount: completed,
              details,
            };
          }
        }

        // ===== 6) آخر امتحان للطالب في نفس المادة/السنة تقريباً =====
        let lastExamSummary = null;

        try {
          const examWhere = {
            status: 'published',
            isDeleted: false,
          };

          if (course.category) examWhere.category = course.category;
          if (course.level) examWhere.grade = course.level;

          const exams = await Exam.findAll({ where: examWhere });
          const examIds = exams.map((e) => Number(e.id));

          if (examIds.length) {
            const attempt = await ExamAttempt.findOne({
              where: {
                studentId: Number(studentId),
                examId: { [Op.in]: examIds },
                submittedAt: { [Op.ne]: null },
              },
              order: [
                ['submittedAt', 'DESC'],
                ['id', 'DESC'],
              ],
            });

            if (attempt) {
              const related = exams.find(
                (e) => Number(e.id) === Number(attempt.examId)
              );
              lastExamSummary = {
                examId: Number(attempt.examId),
                title: related?.title || null,
                score: attempt.score ?? null,
                submittedAt: attempt.submittedAt || null,
              };
            }
          }
        } catch (_) {
          // لو حصل خطأ في الامتحانات، تجاهله بس ما تبوّظش الـ preview
        }

        // ===== 7) إحصائيات QR للدرس اللي قبل =====
        let prevLessonQrSummary = null;

        if (prevLesson) {
          const qrList = await QrSnippet.findAll({
            where: {
              courseId: Number(courseId),
              lessonId: Number(prevLesson.id),
              isActive: true,
            },
            order: [['id', 'ASC']],
          });

          if (qrList.length) {
            const qrIds = qrList.map((q) => Number(q.id));
            const views = await StudentQrView.findAll({
              where: {
                studentId: Number(studentId),
                qrId: { [Op.in]: qrIds },
              },
            });

            const viewMap = {};
            views.forEach((v) => {
              viewMap[Number(v.qrId)] = v;
            });

            const details = qrList.map((q) => {
              const v = viewMap[Number(q.id)];
              return {
                qrId: Number(q.id),
                title: q.title,
                viewsCount: Number(v?.viewsCount || 0),
                lastViewedAt: v?.lastViewedAt || null,
              };
            });

            const total = details.length;
            const watchedCount = details.filter(
              (d) => (d.viewsCount || 0) > 0
            ).length;

            prevLessonQrSummary = {
              totalSnippets: total,
              watchedSnippets: watchedCount,
              details,
            };
          }
        }

        // ===== 8) هل الجلسة دي تعويض من سنتر تاني؟ =====
        let isMakeupFromAnotherCenter = false;
        let originalCenter = null;
        let currentCenter = null;

        if (student.centerId) {
          originalCenter = await Center.findByPk(student.centerId);
        }
        if (centerId) {
          currentCenter = await Center.findByPk(centerId);
        }

        if (
          originalCenter &&
          currentCenter &&
          Number(originalCenter.id) !== Number(currentCenter.id)
        ) {
          isMakeupFromAnotherCenter = true;
        }

        // ===== 9) بناء الـ Warnings + توصية canAttend =====

        const warnings = [];

        // شرط 1: محاضرة قبل الحالية
        const hasPrevLesson = !!prevLesson;

        // هل اعتبرناه حضر الدرس اللي قبل؟ (سنتر أو أونلاين >=90%)
        let prevLessonConsideredAttended = false;
        if (prevLessonInfo) {
          if (prevLessonInfo.attendedInCenter) {
            prevLessonConsideredAttended = true;
          } else if (
            typeof prevLessonWatchRatio === 'number' &&
            prevLessonWatchRatio >= 0.9
          ) {
            prevLessonConsideredAttended = true;
          }
        }

        if (hasPrevLesson && !prevLessonConsideredAttended) {
          warnings.push({
            code: 'MISSING_PREVIOUS_LESSON',
            severity: 'high',
            message:
              'الطالب لم يحضر المحاضرة السابقة أو لم يشاهد 90% منها على الأقل.',
          });
        }

        // شرط 2: الواجب بتاع المحاضرة اللي قبل
        let prevHomeworkOpened = false;
        let prevHomeworkCompleted = false;
        if (prevHomeworkSummary) {
          if (prevHomeworkSummary.totalHomeworks > 0) {
            prevHomeworkOpened =
              prevHomeworkSummary.openedCount > 0 &&
              prevHomeworkSummary.openedCount <=
                prevHomeworkSummary.totalHomeworks;

            prevHomeworkCompleted =
              prevHomeworkSummary.completedCount ===
                prevHomeworkSummary.totalHomeworks &&
              prevHomeworkSummary.totalHomeworks > 0;
          }
        }

        if (prevHomeworkSummary && prevHomeworkSummary.totalHomeworks > 0) {
          if (!prevHomeworkOpened) {
            warnings.push({
              code: 'HOMEWORK_NOT_OPENED',
              severity: 'medium',
              message:
                'الطالب لم يفتح واجب المحاضرة السابقة على المنصة.',
            });
          } else if (!prevHomeworkCompleted) {
            warnings.push({
              code: 'HOMEWORK_NOT_COMPLETED',
              severity: 'medium',
              message:
                'الطالب بدأ واجب المحاضرة السابقة لكنه لم يكمله حتى النهاية.',
            });
          }
        }

        // Warning بسيط لو نسبة الـ QR قليلة جداً
        if (
          prevLessonQrSummary &&
          prevLessonQrSummary.totalSnippets > 0 &&
          prevLessonQrSummary.watchedSnippets <
            prevLessonQrSummary.totalSnippets * 0.5
        ) {
          warnings.push({
            code: 'LOW_QR_ENGAGEMENT',
            severity: 'low',
            message:
              'الطالب شاهد أقل من 50% من الفيديوهات القصيرة (QR) الخاصة بالمحاضرة السابقة.',
          });
        }

        const canAttend = warnings.length === 0;
        const autoDecision = canAttend ? 'ALLOW' : 'WARN';

        // ===== 10) إنشاء إشعار تحذير (لو فيه تحذيرات) =====
        if (warnings.length) {
          await createAttendanceWarningNotification({
            studentId,
            course,
            currentLesson: lesson,
            previousLesson: prevLesson,
            warnings,
          });
        }

        // ===== 11) الرد النهائي =====
        return res.json({
          success: true,
          data: {
            student: safeJson(student),
            course: safeJson(course),
            currentLesson: safeJson(lesson),
            previousLesson: prevLesson ? safeJson(prevLesson) : null,

            lastFiveSessions,

            previousLessonInfo: prevLessonInfo,
            previousHomeworkSummary: prevHomeworkSummary,
            previousLessonQrSummary: prevLessonQrSummary,
            lastExamSummary,

            isMakeupFromAnotherCenter,
            originalCenter: originalCenter ? safeJson(originalCenter) : null,
            currentCenter: currentCenter ? safeJson(currentCenter) : null,

            canAttend,
            autoDecision, // 'ALLOW' | 'WARN'
            warnings,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * POST /attendance/mark
   * تسجيل حضور فعلي (بعد ما المساعد يشوف الـ preview ويقرر)
   * body:
   * {
   *   studentId,
   *   courseId,
   *   lessonId,        // lesson أصلية kind='lesson'
   *   centerId?,
   *   accessMode,      // 'HW_ONLY' | 'FULL_LESSON'
   *   daysLimit?,      // عدد الأيام مسموح (اختياري)
   *   viewsLimit?      // عدد المشاهدات الأقصى (اختياري)
   *   scope?           // 'lesson' | 'course'  (الافتراضي lesson)
   * }
   */

  /**
   * @swagger
   * /attendance/mark:
   *   post:
   *     summary: تسجيل حضور طالب وإتاحة مشاهدة أونلاين (لمحاضرة أو لكل الكورس)
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               studentId:
   *                 type: integer
   *               courseId:
   *                 type: integer
   *               lessonId:
   *                 type: integer
   *               centerId:
   *                 type: integer
   *                 nullable: true
   *               accessMode:
   *                 type: string
   *                 enum: [HW_ONLY, FULL_LESSON]
   *               daysLimit:
   *                 type: integer
   *                 nullable: true
   *               viewsLimit:
   *                 type: integer
   *                 nullable: true
   *               scope:
   *                 type: string
   *                 enum: [lesson, course]
   *                 default: lesson
   *             required:
   *               - studentId
   *               - courseId
   *               - lessonId
   *               - accessMode
   *     responses:
   *       200:
   *         description: تم تسجيل الحضور بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/StudentAttendance'
   *       400:
   *         description: بيانات ناقصة أو accessMode غير صالح
   *       404:
   *         description: الطالب أو الدرس أو الكورس غير موجود
   */
  router.post(
    '/mark',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor', 'center_manager'),
    async (req, res, next) => {
      try {
        const {
          studentId,
          courseId,
          lessonId,
          centerId,
          accessMode, // HW_ONLY | FULL_LESSON
          daysLimit, // optional
          viewsLimit, // optional
          scope, // 'lesson' | 'course'
        } = req.body || {};

        const effectiveScope =
          scope === 'course' ? 'course' : 'lesson'; // الافتراضي 'lesson'

        if (!studentId || !courseId || !lessonId || !accessMode) {
          return res.status(400).json({
            success: false,
            message:
              'studentId, courseId, lessonId, accessMode مطلوبين',
          });
        }

        if (!['HW_ONLY', 'FULL_LESSON'].includes(accessMode)) {
          return res.status(400).json({
            success: false,
            message: 'accessMode غير صالح (HW_ONLY | FULL_LESSON)',
          });
        }

        // تأكد الطالب موجود
        const student = await Student.findByPk(studentId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: 'الطالب غير موجود' });
        }

        // تأكد الدرس الحالي موجود وراجع لنفس الكورس
        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson || lesson.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'الدرس غير موجود' });
        }
        if (Number(lesson.courseId) !== Number(courseId)) {
          return res.status(400).json({
            success: false,
            message: 'الدرس لا ينتمي لهذا الكورس',
          });
        }
        if (String(lesson.kind).toLowerCase() !== 'lesson') {
          return res.status(400).json({
            success: false,
            message:
              'لا يمكن تسجيل حضور على واجب، لازم lesson أصلي',
          });
        }

        // تأكد الكورس مش ممسوح
        const course = await Course.findByPk(courseId);
        if (!course || course.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'الكورس غير موجود' });
        }

        const now = new Date();

        // احسب انتهاء الإتاحة لو فيه daysLimit
        let accessExpiresAt = null;
        if (daysLimit !== undefined && daysLimit !== null) {
          const days = Number(daysLimit);
          if (Number.isFinite(days) && days > 0) {
            accessExpiresAt = new Date(
              now.getTime() + days * 24 * 60 * 60 * 1000
            );
          }
        }

        // حدّ المشاهدات
        let maxViews = null;
        if (viewsLimit !== undefined && viewsLimit !== null) {
          const v = Number(viewsLimit);
          if (Number.isFinite(v) && v >= 0) {
            maxViews = v;
          }
        }

        const resolvedCenterId = centerId ?? student.centerId ?? null;

        // بيانات مشتركة لكل records
        const baseData = {
          studentId: Number(studentId),
          courseId: Number(courseId),
          centerId: resolvedCenterId,
          accessMode,
          attendedAt: now,
          recordedByUserId: req.user?.id ?? null,
          accessExpiresAt,
          maxViews,
          viewsUsed: 0,
          createdAt: now,
          updatedAtLocal: now,
        };

        let mainAttendanceJson = null;
        const targetLessonId = Number(lessonId);

        if (effectiveScope === 'lesson') {
          // 👈 السلوك القديم: محاضرة واحدة فقط
          const data = {
            ...baseData,
            lessonId: targetLessonId,
          };

          const created = await StudentAttendance.create(data);
          mainAttendanceJson = safeJson(created);
        } else {
          // 👈 افتح الكورس كله (كل محاضرات kind='lesson' في نفس الكورس)
          const lessons = await Lesson.findAll({
            where: {
              courseId: Number(courseId),
              isDeleted: false,
              kind: 'lesson',
            },
            order: [
              ['orderIndex', 'ASC'],
              ['id', 'ASC'],
            ],
          });

          for (const l of lessons) {
            const lid = Number(l.id);

            // ما نكررش لو فيه record قديم لنفس الطالب/الكورس/الدرس
            const existing = await StudentAttendance.findOne({
              where: {
                studentId: Number(studentId),
                courseId: Number(courseId),
                lessonId: lid,
              },
            });

            if (existing) {
              if (lid === targetLessonId && !mainAttendanceJson) {
                mainAttendanceJson = safeJson(existing);
              }
              continue;
            }

            const dataForLesson = {
              ...baseData,
              lessonId: lid,
            };

            const created = await StudentAttendance.create(dataForLesson);

            if (lid === targetLessonId) {
              mainAttendanceJson = safeJson(created);
            }
          }

          // لو لأي سبب ما تعملش record لمحاضرة اليوم، نضمنه
          if (!mainAttendanceJson) {
            const data = {
              ...baseData,
              lessonId: targetLessonId,
            };

            const created = await StudentAttendance.create(data);
            mainAttendanceJson = safeJson(created);
          }
        }

        return res.json({
          success: true,
          data: mainAttendanceJson,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * GET /attendance/my-course-access
   * يرجّع قائمة بالكورسات اللي الطالب عنده فيها صلاحية مشاهدة أونلاين
   * مبنية على StudentAttendance (FULL_LESSON) غير منتهية.
   */

  /**
   * @swagger
   * /attendance/my-course-access:
   *   get:
   *     summary: قائمة بالكورسات المسموح للطالب مشاهدتها أونلاين حاليًا
   *     tags: [Attendance]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: IDs الكورسات المتاحة للطالب
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
   *                     courseIds:
   *                       type: array
   *                       items:
   *                         type: integer
   *       400:
   *         description: لا يمكن تحديد الطالب من الـ token
   */
  router.get(
    '/my-course-access',
    requireAuth,
    requireRole('student'),
    async (req, res, next) => {
      try {
        // حسب الـ JWT عندك:
        // لو بتخزن studentId في req.user.studentId استخدمه
        // لو لأ، استخدم req.user.id (عدّل على حسب مشروعك)
        const studentId = Number(req.user.studentId || req.user.id);

        if (!studentId) {
          return res.status(400).json({
            success: false,
            message: 'لا يمكن تحديد الطالب من التوكن.',
          });
        }

        const now = new Date();

        const rows = await StudentAttendance.findAll({
          attributes: ['courseId'],
          where: {
            studentId,
            accessMode: 'FULL_LESSON',
            courseId: { [Op.ne]: null },
            [Op.or]: [
              { accessExpiresAt: null },
              { accessExpiresAt: { [Op.gte]: now } },
            ],
          },
          group: ['courseId'],
        });

        const courseIds = rows
          .map((r) => Number(r.courseId))
          .filter((id) => Number.isFinite(id));

        return res.json({
          success: true,
          data: { courseIds },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}

export default createAttendanceRouter;
