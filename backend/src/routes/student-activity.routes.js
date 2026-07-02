// src/routes/student-activity.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';
import { normalizeLevel } from '../utils/levels.js';

/**
 * @swagger
 * tags:
 *   - name: StudentActivity
 *     description: تقارير نشاط الطالب (محاضرات، واجبات، امتحانات، streak)
 *
 * components:
 *   schemas:
 *     StudentActivitySummary:
 *       type: object
 *       description: ملخّص عام لنشاط الطالب
 *       properties:
 *         watchedLectures:
 *           type: integer
 *           description: عدد المحاضرات التي تم حضورها أونلاين أو في السنتر (منجزة)
 *         totalLectures:
 *           type: integer
 *           description: إجمالي عدد المحاضرات المتاحة لهذا الطالب
 *         solvedHomeworks:
 *           type: integer
 *           description: عدد الواجبات (فيديو) التي تم إنجازها
 *         totalHomeworks:
 *           type: integer
 *           description: إجمالي عدد الواجبات (فيديو) المحسوبة
 *         solvedExams:
 *           type: integer
 *           description: عدد الامتحانات التي تم تسليمها
 *         avgScore:
 *           type: integer
 *           description: متوسط الدرجة في الامتحانات (من 100)
 *         streakDays:
 *           type: integer
 *           description: عدد الأيام المتتالية التي كان فيها الطالب نشطاً
 *         lastActiveAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: آخر وقت كان فيه الطالب نشطاً (أونلاين/سنتر/امتحان)
 *
 *     StudentActivityRecentExam:
 *       type: object
 *       description: امتحان حديث حلّه الطالب
 *       properties:
 *         id:
 *           type: integer
 *           description: رقم الامتحان
 *         title:
 *           type: string
 *           description: عنوان الامتحان
 *         date:
 *           type: string
 *           format: date-time
 *         score:
 *           type: number
 *           description: درجة الطالب في الامتحان
 *         maxScore:
 *           type: number
 *           description: الدرجة الكاملة (عادة 100)
 *         status:
 *           type: string
 *           description: حالة الامتحان بناءً على الدرجة
 *           enum: [pending, passed, failed]
 *
 *     StudentActivityRecentLecture:
 *       type: object
 *       description: محاضرة حديثة تفاعل معها الطالب
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         course:
 *           type: string
 *           description: اسم الكورس المرتبطة به المحاضرة
 *         progressPercent:
 *           type: integer
 *           description: نسبة مشاهدة الفيديو من 0 إلى 100 (أو 100 في حالة حضور السنتر فقط)
 *         lastWatchedAt:
 *           type: string
 *           format: date-time
 *
 *     StudentActivityRecentHomework:
 *       type: object
 *       description: واجب فيديو حديث للطالب
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         course:
 *           type: string
 *         status:
 *           type: string
 *           description: حالة الواجب
 *           enum: [missing, review, submitted]
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         grade:
 *           type: number
 *           nullable: true
 *
 *     StudentActivityData:
 *       type: object
 *       description: هيكل تقرير النشاط الكامل للطالب
 *       properties:
 *         summary:
 *           $ref: '#/components/schemas/StudentActivitySummary'
 *         recentExams:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudentActivityRecentExam'
 *         recentLectures:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudentActivityRecentLecture'
 *         recentHomeworks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudentActivityRecentHomework'
 *
 *     StudentActivityResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/StudentActivityData'
 */

export default function createStudentActivityRouter(models) {
  const router = Router();

  const {
    StudentMysql,
    Student,

    CourseMysql,
    Course,

    LessonMysql,
    Lesson,

    StudentLessonProgressMysql,
    StudentLessonProgress,

    StudentAttendanceMysql,
    StudentAttendance,

    ExamAttemptMysql,
    ExamAttempt,

    ExamMysql,
    Exam,
  } = models;

  const StudentModel =
    StudentMysql || Student || models.StudentMysql || models.Student || null;

  const CourseModel =
    CourseMysql || Course || models.CourseMysql || models.Course || null;

  const LessonModel =
    LessonMysql || Lesson || models.LessonMysql || models.Lesson || null;

  const StudentLessonProgressModel =
    StudentLessonProgressMysql ||
    StudentLessonProgress ||
    models.StudentLessonProgressMysql ||
    models.StudentLessonProgress ||
    null;

  const StudentAttendanceModel =
    StudentAttendanceMysql ||
    StudentAttendance ||
    models.StudentAttendanceMysql ||
    models.StudentAttendance ||
    null;

  const ExamAttemptModel =
    ExamAttemptMysql ||
    ExamAttempt ||
    models.ExamAttemptMysql ||
    models.ExamAttempt ||
    null;

  const ExamModel =
    ExamMysql || Exam || models.ExamMysql || models.Exam || null;

  if (!StudentModel || !CourseModel || !LessonModel || !StudentLessonProgressModel) {
    throw new Error(
      'StudentActivity router: required models not configured (Student / Course / Lesson / StudentLessonProgress)',
    );
  }

  // ===== Helpers للتواريخ =====
  function toSafeDate(value) {
    if (!value && value !== 0) return null;

    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function toSafeISOString(value) {
    const d = toSafeDate(value);
    return d ? d.toISOString() : null;
  }

  // threshold المشاهدة (50%)
  const WATCH_THRESHOLD = 0.5;

  // ===================================================================
  // دالة التجميع الرئيسية لنشاط طالب معيّن
  // ===================================================================
  async function buildStudentActivity(studentId) {
    const student = await StudentModel.findByPk(studentId);
    if (!student) return null;

    const levelNorm = normalizeLevel(student.year) || student.year || null;

    const courseWhere = { isDeleted: false };
    if (levelNorm) {
      courseWhere.level = levelNorm;
    }

    const coursesPromise = CourseModel.findAll({
      where: courseWhere,
      attributes: ['id', 'title'],
    });

    const progressPromise = StudentLessonProgressModel.findAll({
      where: { studentId },
      order: [
        ['lastSeenAt', 'DESC'],
        ['updatedAtLocal', 'DESC'],
      ],
    });

    const attendancePromise = StudentAttendanceModel
      ? StudentAttendanceModel.findAll({
          where: { studentId },
          order: [['attendedAt', 'DESC']],
        })
      : Promise.resolve([]);

    const examAttemptsPromise = ExamAttemptModel
      ? ExamAttemptModel.findAll({
          where: { studentId },
          order: [
            ['submittedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        })
      : Promise.resolve([]);

    const [courses, progRows, attRowsRaw, examAttempts] = await Promise.all([
      coursesPromise,
      progressPromise,
      attendancePromise,
      examAttemptsPromise,
    ]);

    const attRows = attRowsRaw.filter((a) => !a.isDeleted);

    const courseIds = courses.map((c) => Number(c.id));
    const courseMap = new Map(courses.map((c) => [Number(c.id), c]));

    const lessonWhereBase = { isDeleted: false };
    if (courseIds.length) {
      lessonWhereBase.courseId = { [Op.in]: courseIds };
    }

    // محاضرات: kind = 'lesson'
    const allLessons = await LessonModel.findAll({
      where: { ...lessonWhereBase, kind: 'lesson' },
      attributes: ['id', 'courseId', 'title', 'kind'],
    });

    // واجبات: kind = 'homework'
    const allHomeworkLessons = await LessonModel.findAll({
      where: { ...lessonWhereBase, kind: 'homework' },
      attributes: ['id', 'courseId', 'title', 'kind', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    const lessonIds = allLessons.map((l) => Number(l.id));
    const hwLessonIdsFromLessons = allHomeworkLessons.map((l) =>
      Number(l.id),
    );

    // map عام لكل الدروس (محاضرات + واجبات) عشان نجيب العناوين
    const lessonMap = new Map(
      [...allLessons, ...allHomeworkLessons].map((l) => [
        Number(l.id),
        l,
      ]),
    );
    const homeworkLessonMap = new Map(
      allHomeworkLessons.map((l) => [Number(l.id), l]),
    );

    // map progress لكل درس
    const progressByLessonId = new Map();
    progRows.forEach((p) => {
      progressByLessonId.set(Number(p.lessonId), p);
    });

    // واجبات مستنتجة من progress (لو في isHomework أو lessonKind)
    const hwLessonIdsFromProgress = progRows
      .filter((p) => {
        if (p.isHomework === true) return true;
        if (typeof p.lessonKind === 'string') {
          return p.lessonKind === 'homework';
        }
        return false;
      })
      .map((p) => Number(p.lessonId))
      .filter((id) => Number.isFinite(id) && id > 0);

    // كل الـ lessonIds اللي نعتبرها "واجبات فيديو"
    const allHwLessonIdSet = new Set([
      ...hwLessonIdsFromLessons,
      ...hwLessonIdsFromProgress,
    ]);
    const allHwLessonIds = Array.from(allHwLessonIdSet);

    // حضور سنتر للمحاضرات
    const attendanceByLessonId = new Set(
      attRows
        .map((a) => Number(a.lessonId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    // ===== Summary: Lectures =====
    // محاضرة تعتبر منجزة لو:
    // - progress موجود NOT homework AND شاف ≥ 50% أو fullyWatched
    // - أو عنده حضور سنتر للدرس
    const watchedLectures = lessonIds.filter((id) => {
      const p = progressByLessonId.get(id);

      let watchedOnline = false;
      if (p) {
        const isHw =
          p.isHomework === true ||
          p.lessonKind === 'homework' ||
          homeworkLessonMap.has(id);
        if (!isHw) {
          const duration = Number(p.durationSecCached || 0) || 0;
          const watched = Number(p.maxWatchedSec || 0) || 0;
          const ratio = duration > 0 ? watched / duration : 0;
          watchedOnline = !!p.fullyWatched || ratio >= WATCH_THRESHOLD;
        }
      }

      const attendedInCenter = attendanceByLessonId.has(id);
      return watchedOnline || attendedInCenter;
    }).length;

    const totalLectures = lessonIds.length;

    // ===== Summary: Homeworks (واجبات فيديو) =====
    const solvedHomeworks = allHwLessonIds.filter((id) => {
      const p = progressByLessonId.get(id);
      if (!p) return false;

      const duration = Number(p.durationSecCached || 0) || 0;
      const watched = Number(p.maxWatchedSec || 0) || 0;
      const ratio = duration > 0 ? watched / duration : 0;

      return !!p.fullyWatched || ratio >= WATCH_THRESHOLD;
    }).length;

    const totalHomeworks = allHwLessonIds.length;

    // ===== Summary: Exams =====
    const submittedAttempts = Array.isArray(examAttempts)
      ? examAttempts.filter((a) => a.submittedAt)
      : [];

    const solvedExams = submittedAttempts.length;

    let avgScore = 0;
    if (solvedExams > 0) {
      const sumScore = submittedAttempts.reduce(
        (sum, a) => sum + (Number(a.score) || 0),
        0,
      );
      avgScore = Math.round(sumScore / solvedExams);
    }

    // ===== lastActive + streak =====
    const activityDatesRaw = [];

    progRows.forEach((p) => {
      const dates = [
        toSafeDate(p.lastSeenAt),
        toSafeDate(p.completedAt),
        toSafeDate(p.updatedAtLocal),
      ].filter(Boolean);

      if (dates.length) {
        // ناخد أحدث تاريخ فعلي للنشاط
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        activityDatesRaw.push(maxDate);
      }
    });

    attRows.forEach((a) => {
      const raw = a.attendedAt || a.createdAt || a.updatedAtLocal;
      const d = toSafeDate(raw);
      if (d) activityDatesRaw.push(d);
    });

    submittedAttempts.forEach((a) => {
      const dates = [
        toSafeDate(a.submittedAt),
        toSafeDate(a.updatedAtLocal),
      ].filter(Boolean);

      if (dates.length) {
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        activityDatesRaw.push(maxDate);
      }
    });

    const validActivityDates = activityDatesRaw.filter(
      (d) => d && Number.isFinite(d.getTime()),
    );

    let lastActiveAt = null;
    if (validActivityDates.length) {
      const maxTs = Math.max(
        ...validActivityDates.map((d) => d.getTime()),
      );
      if (Number.isFinite(maxTs)) {
        lastActiveAt = new Date(maxTs);
      }
    }

    const dayKeys = new Set(
      validActivityDates.map((d) => d.toISOString().slice(0, 10)),
    );

    const today = new Date();
    const base = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    let streakDays = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dayKeys.has(key)) streakDays++;
      else break;
    }

    const summary = {
      watchedLectures,
      totalLectures,
      solvedHomeworks,
      totalHomeworks,
      solvedExams,
      avgScore,
      streakDays,
      lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
    };

    // ===== recentExams =====
    const examIds = Array.from(
      new Set(
        submittedAttempts
          .filter((a) => a.examId != null)
          .map((a) => Number(a.examId)),
      ),
    );

    let examMap = new Map();
    if (examIds.length && ExamModel) {
      const exams = await ExamModel.findAll({
        where: { id: { [Op.in]: examIds } },
        attributes: ['id', 'title'],
      });
      examMap = new Map(exams.map((e) => [Number(e.id), e]));
    }

    const recentExams = submittedAttempts
      .slice()
      .sort((a, b) => {
        const da = toSafeDate(a.submittedAt || a.startedAt);
        const db = toSafeDate(b.submittedAt || b.startedAt);
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5)
      .map((a) => {
        const exam = examMap.get(Number(a.examId));
        const scoreVal = Number(a.score ?? 0);
        let status = 'pending';
        if (a.submittedAt) {
          status = scoreVal >= 60 ? 'passed' : 'failed';
        }

        const isoDate =
          toSafeISOString(a.submittedAt || a.startedAt) ||
          new Date().toISOString();

        return {
          id: Number(a.examId),
          title: exam?.title || `امتحان رقم ${a.examId}`,
          date: isoDate,
          score: scoreVal,
          maxScore: 100,
          status,
        };
      });

    // ===== recentLectures (محاضرات فقط – نستبعد الواجبات) =====
    const lectureMap = new Map();

    // من الـ progress
    for (const p of progRows) {
      const lid = Number(p.lessonId);
      if (!lid) continue;

      // استبعد أي progress متعلّق بواجب
      const isHw =
        p.isHomework === true ||
        p.lessonKind === 'homework' ||
        homeworkLessonMap.has(lid);
      if (isHw) continue;

      let entry = lectureMap.get(lid);
      if (!entry) {
        entry = {
          lessonId: lid,
          progress: null,
          attendance: null,
          lastInteractionAt: 0,
        };
      }

      entry.progress = p;

      const d =
        toSafeDate(
          p.lastSeenAt || p.updatedAtLocal || p.completedAt,
        ) || new Date();
      const ts = d.getTime();
      if (Number.isFinite(ts) && ts > entry.lastInteractionAt) {
        entry.lastInteractionAt = ts;
      }

      lectureMap.set(lid, entry);
    }

    // من حضور السنتر
    for (const a of attRows) {
      const lid = Number(a.lessonId);
      if (!lid) continue;

      let entry = lectureMap.get(lid);
      if (!entry) {
        entry = {
          lessonId: lid,
          progress: null,
          attendance: null,
          lastInteractionAt: 0,
        };
      }

      entry.attendance = a;

      const d =
        toSafeDate(
          a.attendedAt || a.updatedAtLocal || a.createdAt,
        ) || new Date();
      const ts = d.getTime();
      if (Number.isFinite(ts) && ts > entry.lastInteractionAt) {
        entry.lastInteractionAt = ts;
      }

      lectureMap.set(lid, entry);
    }

    const lectureEntries = Array.from(lectureMap.values()).sort(
      (a, b) => b.lastInteractionAt - a.lastInteractionAt,
    );

    const lectureItems = [];
    for (const entry of lectureEntries) {
      const l = lessonMap.get(Number(entry.lessonId));
      if (!l) continue;
      const course = courseMap.get(Number(l.courseId));

      let percent = 0;
      const p = entry.progress;

      if (p) {
        const duration = Number(p.durationSecCached ?? 0) || 0;
        const watched = Number(p.maxWatchedSec ?? 0) || 0;
        if (duration > 0) {
          percent = Math.round((watched / duration) * 100);
        } else if (p.fullyWatched) {
          percent = 100;
        }
      } else if (entry.attendance) {
        percent = 100;
      }

      const isoLast =
        toSafeISOString(entry.lastInteractionAt) ||
        new Date().toISOString();

      lectureItems.push({
        id: Number(l.id),
        title: l.title,
        course: course?.title || '',
        progressPercent: percent,
        lastWatchedAt: isoLast,
      });
    }

    lectureItems.sort(
      (a, b) =>
        new Date(b.lastWatchedAt).getTime() -
        new Date(a.lastWatchedAt).getTime(),
    );

    const recentLectures = lectureItems.slice(0, 5).map((l) => ({
      id: l.id,
      title: l.title,
      course: l.course,
      progressPercent: l.progressPercent,
      lastWatchedAt: l.lastWatchedAt,
    }));

    // ===== recentHomeworks (من Lesson.kind = 'homework' + progress) =====
    const hwItems = [];

    for (const lessonId of allHwLessonIds) {
      const l = lessonMap.get(lessonId);
      const p = progressByLessonId.get(lessonId) || null;

      const course = l
        ? courseMap.get(Number(l.courseId))
        : null;

      const duration = Number(p?.durationSecCached ?? 0) || 0;
      const watched = Number(p?.maxWatchedSec ?? 0) || 0;
      const ratio = duration > 0 ? watched / duration : 0;

      let status = 'missing';
      let submittedAt = null;

      if (p) {
        if (p.fullyWatched || ratio >= WATCH_THRESHOLD) {
          status = 'submitted';
          submittedAt =
            p.completedAt || p.lastSeenAt || p.updatedAtLocal || null;
        } else if (watched > 0) {
          status = 'review';
          submittedAt = p.lastSeenAt || p.updatedAtLocal || null;
        }
      }

      const safeSubmittedIso = submittedAt
        ? toSafeISOString(submittedAt)
        : null;

      hwItems.push({
        id: lessonId,
        title: l?.title || `واجب رقم ${lessonId}`,
        course: course?.title || '',
        status,
        submittedAt: safeSubmittedIso,
        grade: null,
      });
    }

    hwItems.sort((a, b) => {
      const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return db - da;
    });

    const recentHomeworks = hwItems.slice(0, 5).map((h) => ({
      id: h.id,
      title: h.title,
      course: h.course,
      status: h.status,
      submittedAt: h.submittedAt,
      grade: h.grade,
    }));

    return {
      summary,
      recentExams,
      recentLectures,
      recentHomeworks,
    };
  }

  // ========== الطالب نفسه ==========
  /**
   * @swagger
   * /student-activity/me:
   *   get:
   *     summary: تقرير نشاط الطالب الحالي
   *     description: يرجع ملخص نشاط الطالب (محاضرات، واجبات، امتحانات، streak) بناءً على الـ JWT الحالي (role=student).
   *     tags: [StudentActivity]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: تقرير نشاط الطالب الحالي
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentActivityResponse'
   *       403:
   *         description: الحساب الحالي ليس طالباً أو لا توجد صلاحيات
   *       404:
   *         description: الحساب غير موجود
   *       500:
   *         description: خطأ في السيرفر
   */
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'مصرّح للطلاب فقط',
        });
      }

      const data = await buildStudentActivity(studentId);
      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'الحساب غير موجود',
        });
      }

      return res.json({ success: true, data });
    } catch (e) {
      console.error('Error in GET /student-activity/me', e);
      next(e);
    }
  });

  // ========== أدمن: تقرير طالب معيّن ==========
  /**
   * @swagger
   * /student-activity/admin/{id}:
   *   get:
   *     summary: تقرير نشاط طالب معيّن (عرض إداري)
   *     description: يسمح للأدمن بجلب تقرير النشاط الكامل لطالب معيّن حسب الـ studentId.
   *     tags: [StudentActivity]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الطالب (studentId)
   *     responses:
   *       200:
   *         description: تقرير نشاط الطالب المطلوب
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentActivityResponse'
   *       400:
   *         description: id غير صالح
   *       403:
   *         description: مصرح للأدمن فقط
   *       404:
   *         description: الحساب غير موجود
   *       500:
   *         description: خطأ في السيرفر
   */
router.get(
  '/admin/:id',
  requireAuth,
  requireRole('admin', 'user'),
  async (req, res, next) => {
    try {
      const studentId = Number(req.params.id);
      if (!studentId || Number.isNaN(studentId)) {
        return res.status(400).json({
          success: false,
          message: 'id غير صالح',
        });
      }

      const data = await buildStudentActivity(studentId);
      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'الحساب غير موجود',
        });
      }

      return res.json({ success: true, data });
    } catch (e) {
      console.error('Error in GET /student-activity/admin/:id', e);
      next(e);
    }
  }
);


  return router;
}
