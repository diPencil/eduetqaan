// src/routes/student-insights.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   - name: StudentInsights
 *     description: إنسايت ولوحة تحكم المدرس عن حالة الطالب داخل الكورس والمحاضرات
 *
 * components:
 *   schemas:
 *     StudentInsightsStudent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         centerId:
 *           type: integer
 *           nullable: true
 *         centerName:
 *           type: string
 *           nullable: true
 *
 *     StudentInsightsCourse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *
 *     StudentInsightsLesson:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         kind:
 *           type: string
 *           description: نوع المحاضرة (lesson | homework | exam... إلخ بحسب الـ model).
 *         orderIndex:
 *           type: integer
 *
 *     StudentInsightsLastLessonItem:
 *       type: object
 *       properties:
 *         lessonId:
 *           type: integer
 *         lessonTitle:
 *           type: string
 *           nullable: true
 *         lessonKind:
 *           type: string
 *           nullable: true
 *         courseId:
 *           type: integer
 *           nullable: true
 *         courseTitle:
 *           type: string
 *           nullable: true
 *         attendedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: آخر وقت حضور سنتر (إن وجد).
 *         attendanceMode:
 *           type: string
 *           nullable: true
 *           description: "'center' | 'online' | null"
 *         centerId:
 *           type: integer
 *           nullable: true
 *         lastInteractionAt:
 *           type: string
 *           format: date-time
 *         watchedSec:
 *           type: number
 *         durationSec:
 *           type: number
 *           nullable: true
 *         remainingSec:
 *           type: number
 *           nullable: true
 *         progressPercent:
 *           type: integer
 *           nullable: true
 *         fullyWatched:
 *           type: boolean
 *
 *     StudentInsightsPreviousHomeworkItem:
 *       type: object
 *       properties:
 *         lessonId:
 *           type: integer
 *         title:
 *           type: string
 *         watchedSec:
 *           type: number
 *         durationSec:
 *           type: number
 *           nullable: true
 *         remainingSec:
 *           type: number
 *           nullable: true
 *         progressPercent:
 *           type: integer
 *           nullable: true
 *         fullyWatched:
 *           type: boolean
 *
 *     StudentInsightsPreviousHomeworkSummary:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: إجمالي عدد الواجبات المرتبطة بالمحاضرة السابقة.
 *         watchedAnyCount:
 *           type: integer
 *           description: عدد الواجبات التي بدأ فيها الطالب مشاهدة.
 *         fullyWatchedCount:
 *           type: integer
 *           description: عدد الواجبات التي أتمّها الطالب (≥90% أو fullyWatched).
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudentInsightsPreviousHomeworkItem'
 *
 *     StudentInsightsPreviousExamResult:
 *       type: object
 *       nullable: true
 *       properties:
 *         examId:
 *           type: integer
 *         title:
 *           type: string
 *         score:
 *           type: number
 *           nullable: true
 *         attemptedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     StudentInsightsPreviousQrSummary:
 *       type: object
 *       properties:
 *         totalQr:
 *           type: integer
 *           description: إجمالي عدد الـ QR short videos للمحاضرة السابقة.
 *         viewedQr:
 *           type: integer
 *           description: عدد الأكواد التي شاهَدها الطالب.
 *         notViewedQr:
 *           type: integer
 *         viewedPercent:
 *           type: integer
 *           nullable: true
 *           description: نسبة ما تم مشاهدته من إجمالي الأكواد (0–100) أو null لو مفيش أكواد.
 *
 *     StudentInsightsCenterDashboardSummary:
 *       type: object
 *       properties:
 *         student:
 *           $ref: '#/components/schemas/StudentInsightsStudent'
 *         course:
 *           $ref: '#/components/schemas/StudentInsightsCourse'
 *         currentLesson:
 *           $ref: '#/components/schemas/StudentInsightsLesson'
 *         center:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *         isMakeup:
 *           type: boolean
 *           description: هل الزيارة تعويض في سنتر غير السنتر الأساسي للطالب؟
 *         currentAttendance:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             attendedAt:
 *               type: string
 *               format: date-time
 *             centerId:
 *               type: integer
 *               nullable: true
 *         lastLessons:
 *           type: array
 *           description: آخر 5 محاضرات اتفاعل معها الطالب (سنتر أو أونلاين).
 *           items:
 *             $ref: '#/components/schemas/StudentInsightsLastLessonItem'
 *         previousLesson:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             title:
 *               type: string
 *             orderIndex:
 *               type: integer
 *         previousHomeworkSummary:
 *           $ref: '#/components/schemas/StudentInsightsPreviousHomeworkSummary'
 *         previousExamResult:
 *           $ref: '#/components/schemas/StudentInsightsPreviousExamResult'
 *         previousQrSummary:
 *           $ref: '#/components/schemas/StudentInsightsPreviousQrSummary'
 *
 *     StudentInsightsCenterDashboardResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/StudentInsightsCenterDashboardSummary'
 */

export function createStudentInsightsRouter(models) {
  const router = Router();

  const {
    StudentMysql,
    CenterMysql,
    CourseMysql,
    LessonMysql,
    StudentAttendanceMysql,
    StudentLessonProgressMysql,
    QrSnippetMysql,
    StudentQrViewMysql,
    ExamMysql,
    ExamAttemptMysql,
    // fallbacks
    Student,
    Center,
    Course,
    Lesson,
    StudentAttendance,
    StudentLessonProgress,
    QrSnippet,
    StudentQrView,
    Exam,
    ExamAttempt,
  } = models;

  // ===== Aliases بنفس أسلوب باقى المشروع =====
  const StudentModel =
    StudentMysql || Student || models.StudentMysql || models.Student || null;

  const CenterModel =
    CenterMysql || Center || models.CenterMysql || models.Center || null;

  const CourseModel =
    CourseMysql || Course || models.CourseMysql || models.Course || null;

  const LessonModel =
    LessonMysql || Lesson || models.LessonMysql || models.Lesson || null;

  const StudentAttendanceModel =
    StudentAttendanceMysql ||
    StudentAttendance ||
    models.StudentAttendanceMysql ||
    models.StudentAttendance ||
    null;

  const StudentLessonProgressModel =
    StudentLessonProgressMysql ||
    StudentLessonProgress ||
    models.StudentLessonProgressMysql ||
    models.StudentLessonProgress ||
    null;

  const QrSnippetModel =
    QrSnippetMysql ||
    QrSnippet ||
    models.QrSnippetMysql ||
    models.QrSnippet ||
    null;

  const StudentQrViewModel =
    StudentQrViewMysql ||
    StudentQrView ||
    models.StudentQrViewMysql ||
    models.StudentQrView ||
    null;

  const ExamModel =
    ExamMysql || Exam || models.ExamMysql || models.Exam || null;

  const ExamAttemptModel =
    ExamAttemptMysql ||
    ExamAttempt ||
    models.ExamAttemptMysql ||
    models.ExamAttempt ||
    null;

  if (!StudentModel || !CourseModel || !LessonModel || !StudentLessonProgressModel) {
    throw new Error(
      'StudentInsights router: required models not configured (Student / Course / Lesson / StudentLessonProgress)'
    );
  }

  // ===== Helpers =====
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
    const d =
      value instanceof Date || typeof value !== 'number'
        ? toSafeDate(value)
        : new Date(value);
    return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  /**
   * @swagger
   * /student-insights/center-dashboard/summary:
   *   get:
   *     summary: إنسايت سريعة عن حالة الطالب في الكورس للمحاضر داخل السنتر
   *     description: |
   *       ترجع لوحة إنسايت سريعة للمحاضر/الأدمن توضح آخر نشاطات الطالب داخل الكورس والمحاضرة الحالية،
   *       بالإضافة إلى حالة المحاضرة السابقة (واجبات، امتحانات، QR short videos).
   *     tags: [StudentInsights]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: studentId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الطالب (studentId).
   *       - in: query
   *         name: courseId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الكورس الذي تتم فيه المحاضرة الحالية.
   *       - in: query
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم المحاضرة الحالية (lessonId).
   *       - in: query
   *         name: centerId
   *         required: false
   *         schema:
   *           type: integer
   *         description: رقم السنتر الحالي للزيارة (يستخدم لمعرفة هل الزيارة تعويض في سنتر آخر أم لا).
   *     responses:
   *       200:
   *         description: تم إرجاع إنسايت الطالب داخل الكورس بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentInsightsCenterDashboardResponse'
   *       400:
   *         description: studentId أو courseId أو lessonId مفقودة أو غير صالحة
   *       403:
   *         description: يتطلب صلاحيات teacher أو admin
   *       404:
   *         description: الطالب أو الكورس أو المحاضرة غير موجودة
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.get(
    '/center-dashboard/summary',
    requireAuth,
    requireRole('teacher', 'admin'),
    async (req, res, next) => {
      try {
        const studentId = Number(req.query.studentId);
        const courseId = Number(req.query.courseId);
        const lessonId = Number(req.query.lessonId);
        const centerId = req.query.centerId ? Number(req.query.centerId) : null;

        if (!studentId || !courseId || !lessonId) {
          return res.status(400).json({
            success: false,
            message: 'studentId, courseId, lessonId مطلوبة في الـ query',
          });
        }

        // ===== الطالب =====
        const student = await StudentModel.findByPk(studentId);
        if (!student) {
          return res.status(404).json({
            success: false,
            message: 'الطالب غير موجود',
          });
        }

        // سنتر الطالب الأساسى (لو الموديل موجود)
        let studentCenter = null;
        if (CenterModel && student.centerId) {
          studentCenter = await CenterModel.findByPk(student.centerId);
        }

        // ===== الكورس =====
        const course = await CourseModel.findByPk(courseId);
        if (!course || course.isDeleted) {
          return res.status(404).json({
            success: false,
            message: 'الكورس غير موجود',
          });
        }

        // ===== المحاضرة الحالية =====
        const lesson = await LessonModel.findOne({
          where: { id: lessonId, courseId, isDeleted: false },
        });
        if (!lesson) {
          return res.status(404).json({
            success: false,
            message: 'المحاضرة غير موجودة في هذا الكورس',
          });
        }

        // ===== سنتر الزيارة الحالية =====
        let center = null;
        if (centerId && CenterModel) {
          center = await CenterModel.findByPk(centerId);
        }

        const isMakeup =
          !!center &&
          !!student.centerId &&
          Number(student.centerId) !== Number(center.id);

        // ===== آخر حضور للمحاضرة الحالية =====
        let currentAttendance = null;
        if (StudentAttendanceModel) {
          const att = await StudentAttendanceModel.findOne({
            where: { studentId, courseId, lessonId },
            order: [
              ['attendedAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });
          if (att && !att.isDeleted) currentAttendance = att;
        }

        // =============================================
        // (2) آخر ٥ محاضرات (سنتر أو أونلاين)
        // =============================================
        let attendanceRows = [];
        if (StudentAttendanceModel) {
          const rows = await StudentAttendanceModel.findAll({
            where: { studentId },
            order: [
              ['attendedAt', 'DESC'],
              ['id', 'DESC'],
            ],
            limit: 20,
          });
          attendanceRows = rows.filter((a) => !a.isDeleted);
        }

        const progressRows = await StudentLessonProgressModel.findAll({
          where: { studentId },
          order: [
            ['lastSeenAt', 'DESC'],
            ['id', 'DESC'],
          ],
          limit: 20,
        });

        const mergedMap = new Map();

        // دمج الحضور
        for (const att of attendanceRows) {
          const lid = Number(att.lessonId);
          if (!lid) continue;

          const existing =
            mergedMap.get(lid) || {
              lessonId: lid,
              courseId: att.courseId ? Number(att.courseId) : null,
              attendance: null,
              progress: null,
              lastInteractionAt: 0,
            };

          existing.courseId =
            existing.courseId != null
              ? existing.courseId
              : att.courseId
              ? Number(att.courseId)
              : null;
          existing.attendance = att;

          const d =
            toSafeDate(att.attendedAt || att.updatedAtLocal || att.createdAt) ||
            null;
          const ts = d ? d.getTime() : 0;
          if (!existing.lastInteractionAt || ts > existing.lastInteractionAt) {
            existing.lastInteractionAt = ts;
          }

          mergedMap.set(lid, existing);
        }

        // دمج الـ progress
        for (const prog of progressRows) {
          const lid = Number(prog.lessonId);
          if (!lid) continue;

          const existing =
            mergedMap.get(lid) || {
              lessonId: lid,
              courseId: prog.courseId ? Number(prog.courseId) : null,
              attendance: null,
              progress: null,
              lastInteractionAt: 0,
            };

          existing.courseId =
            existing.courseId != null
              ? existing.courseId
              : prog.courseId
              ? Number(prog.courseId)
              : null;
          existing.progress = prog;

          const d =
            toSafeDate(
              prog.lastSeenAt || prog.updatedAtLocal || prog.completedAt
            ) || null;
          const ts = d ? d.getTime() : 0;
          if (!existing.lastInteractionAt || ts > existing.lastInteractionAt) {
            existing.lastInteractionAt = ts;
          }

          mergedMap.set(lid, existing);
        }

        const mergedArr = Array.from(mergedMap.values())
          .filter((e) => e.lastInteractionAt > 0)
          .sort((a, b) => b.lastInteractionAt - a.lastInteractionAt)
          .slice(0, 5);

        const lastLessonIds = [
          ...new Set(mergedArr.map((e) => Number(e.lessonId))),
        ].filter((id) => Number.isFinite(id) && id > 0);

        const lastCourseIds = [
          ...new Set(
            mergedArr
              .map((e) => (e.courseId != null ? Number(e.courseId) : null))
              .filter((id) => id != null)
          ),
        ];

        const lastLessons = lastLessonIds.length
          ? await LessonModel.findAll({
              where: { id: { [Op.in]: lastLessonIds } },
            })
          : [];

        const lastCourses = lastCourseIds.length
          ? await CourseModel.findAll({
              where: { id: { [Op.in]: lastCourseIds } },
            })
          : [];

        const lessonMap = new Map(lastLessons.map((l) => [Number(l.id), l]));
        const courseMap = new Map(lastCourses.map((c) => [Number(c.id), c]));

        const lastLessonsSummary = mergedArr.map((entry) => {
          const lsn = lessonMap.get(Number(entry.lessonId));
          const crs =
            entry.courseId != null
              ? courseMap.get(Number(entry.courseId))
              : null;
          const att = entry.attendance;
          const prog = entry.progress;

          const durationSec =
            Number(prog?.durationSecCached ?? lsn?.durationSec ?? 0) || 0;
          const watchedSec = Number(prog?.maxWatchedSec ?? 0) || 0;

          let progressPercent = null;
          let remainingSec = null;
          let fullyWatched = !!prog?.fullyWatched;

          if (durationSec > 0) {
            progressPercent = Math.min(
              100,
              Math.round((watchedSec / durationSec) * 100)
            );
            remainingSec = Math.max(0, durationSec - watchedSec);
            if (!fullyWatched && progressPercent >= 90) {
              fullyWatched = true;
            }
          }

          let attendanceMode = null;
          if (att) {
            attendanceMode = att.centerId ? 'center' : 'online';
          } else if (prog) {
            attendanceMode = 'online';
          }

          return {
            lessonId: Number(entry.lessonId),
            lessonTitle: lsn?.title ?? null,
            lessonKind: lsn?.kind ?? null,
            courseId:
              entry.courseId != null
                ? Number(entry.courseId)
                : lsn?.courseId != null
                ? Number(lsn.courseId)
                : null,
            courseTitle: crs?.title ?? null,
            attendedAt: att?.attendedAt ?? null,
            attendanceMode,
            centerId: att?.centerId ?? null,
            lastInteractionAt: toSafeISOString(entry.lastInteractionAt),
            watchedSec,
            durationSec: durationSec || null,
            remainingSec,
            progressPercent,
            fullyWatched,
          };
        });

        // =============================================
        // (3) المحاضرة اللي قبل الحالية فى نفس الكورس
        // =============================================
        let previousLesson = null;

        if (lesson.kind === 'lesson') {
          const where = {
            courseId,
            kind: 'lesson',
            isDeleted: false,
          };

          const orConds = [];
          if (lesson.orderIndex != null) {
            orConds.push({ orderIndex: { [Op.lt]: lesson.orderIndex } });
            orConds.push({
              orderIndex: lesson.orderIndex,
              id: { [Op.lt]: lesson.id },
            });
          } else {
            orConds.push({ id: { [Op.lt]: lesson.id } });
          }

          where[Op.or] = orConds;

          previousLesson = await LessonModel.findOne({
            where,
            order: [
              ['orderIndex', 'DESC'],
              ['id', 'DESC'],
            ],
          });
        } else if (lesson.parentLessonId) {
          previousLesson = await LessonModel.findByPk(lesson.parentLessonId);
        }

        // =============================================
        // (4) واجب المحاضرة السابقة
        // =============================================
        let previousHomeworkSummary = null;

        if (previousLesson) {
          const homeworks = await LessonModel.findAll({
            where: {
              parentLessonId: previousLesson.id,
              kind: 'homework',
              isDeleted: false,
            },
            order: [
              ['orderIndex', 'ASC'],
              ['id', 'ASC'],
            ],
          });

          if (homeworks.length) {
            const hwIds = homeworks.map((h) => Number(h.id));
            const hwProgressRows = await StudentLessonProgressModel.findAll({
              where: { studentId, lessonId: { [Op.in]: hwIds } },
            });
            const hwProgMap = new Map(
              hwProgressRows.map((p) => [Number(p.lessonId), p])
            );

            const items = homeworks.map((hw) => {
              const prog = hwProgMap.get(Number(hw.id));
              const durationSec =
                Number(prog?.durationSecCached ?? hw.durationSec ?? 0) || 0;
              const watchedSec = Number(prog?.maxWatchedSec ?? 0) || 0;

              let progressPercent = null;
              let remainingSec = null;
              let fullyWatched = !!prog?.fullyWatched;

              if (durationSec > 0) {
                progressPercent = Math.min(
                  100,
                  Math.round((watchedSec / durationSec) * 100)
                );
                remainingSec = Math.max(0, durationSec - watchedSec);
                if (!fullyWatched && progressPercent >= 90) {
                  fullyWatched = true;
                }
              }

              return {
                lessonId: Number(hw.id),
                title: hw.title,
                watchedSec,
                durationSec: durationSec || null,
                remainingSec,
                progressPercent,
                fullyWatched,
              };
            });

            const total = items.length;
            const fullyWatchedCount = items.filter((i) => i.fullyWatched).length;
            const watchedAnyCount = items.filter(
              (i) => (i.watchedSec || 0) > 0
            ).length;

            previousHomeworkSummary = {
              total,
              watchedAnyCount,
              fullyWatchedCount,
              items,
            };
          }
        }

        // =============================================
        // (5) درجة آخر امتحان للمحاضرة السابقة
        // =============================================
        let previousExamResult = null;

        if (previousLesson && ExamModel && ExamAttemptModel) {
          const lessonExams = await ExamModel.findAll({
            where: {
              lessonId: previousLesson.id,
              isDeleted: false,
              status: 'published',
            },
            order: [
              ['publishedAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });

          const examRow = lessonExams[0];
          if (examRow) {
            const attempt = await ExamAttemptModel.findOne({
              where: { examId: examRow.id, studentId },
              order: [
                ['submittedAt', 'DESC'],
                ['id', 'DESC'],
              ],
            });

            previousExamResult = {
              examId: Number(examRow.id),
              title: examRow.title,
              score:
                attempt && attempt.score != null
                  ? Number(attempt.score)
                  : null,
              attemptedAt: attempt?.submittedAt ?? null,
            };
          }
        }

        // =============================================
        // (6) درجة آخر امتحان امتحنه على المنصة عموما
        // =============================================
        let lastPlatformExamResult = null;

        if (ExamModel && ExamAttemptModel) {
          const lastAttempt = await ExamAttemptModel.findOne({
            where: { studentId, submittedAt: { [Op.not]: null } },
            order: [
              ['submittedAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });
          
          if (lastAttempt && lastAttempt.submittedAt) {
             const examRow = await ExamModel.findByPk(lastAttempt.examId);
             if (examRow) {
                lastPlatformExamResult = {
                  examId: Number(examRow.id),
                  title: examRow.title,
                  score: lastAttempt.score != null ? Number(lastAttempt.score) : null,
                  attemptedAt: lastAttempt.submittedAt,
                  maxScore: examRow.maxScore || 100
                };
             }
          }
        }

        // =============================================
        // (7) QR short videos للمحاضرة السابقة
        // =============================================
        let previousQrSummary = null;

        if (previousLesson && QrSnippetModel && StudentQrViewModel) {
          const qrSnippets = await QrSnippetModel.findAll({
            where: {
              courseId,
              lessonId: previousLesson.id,
              isActive: true,
            },
          });

          const totalQr = qrSnippets.length;
          if (totalQr > 0) {
            const qrIds = qrSnippets.map((q) => Number(q.id));
            const views = await StudentQrViewModel.findAll({
              where: {
                studentId,
                qrId: { [Op.in]: qrIds },
              },
            });

            const viewedQrIds = new Set(
              views
                .filter((v) => Number(v.viewsCount || 0) > 0)
                .map((v) => Number(v.qrId))
            );

            const viewedQr = viewedQrIds.size;
            const notViewedQr = totalQr - viewedQr;
            const viewedPercent = Math.round((viewedQr / totalQr) * 100);

            previousQrSummary = {
              totalQr,
              viewedQr,
              notViewedQr,
              viewedPercent,
            };
          } else {
            previousQrSummary = {
              totalQr: 0,
              viewedQr: 0,
              notViewedQr: 0,
              viewedPercent: null,
            };
          }
        }

        // ===== Response =====
        return res.json({
          success: true,
          data: {
            student: {
              id: Number(student.id),
              name:
                student.fullName ||
                student.name ||
                student.studentName ||
                null,
              centerId: student.centerId ?? null,
              centerName: studentCenter?.name ?? null,
            },
            course: {
              id: Number(course.id),
              title: course.title,
            },
            currentLesson: {
              id: Number(lesson.id),
              title: lesson.title,
              kind: lesson.kind,
              orderIndex: lesson.orderIndex,
            },
            center: center
              ? { id: Number(center.id), name: center.name }
              : null,
            isMakeup,
            currentAttendance: currentAttendance
              ? {
                  id: Number(currentAttendance.id),
                  attendedAt: currentAttendance.attendedAt,
                  centerId: currentAttendance.centerId ?? null,
                }
              : null,
            lastLessons: lastLessonsSummary,
            previousLesson: previousLesson
              ? {
                  id: Number(previousLesson.id),
                  title: previousLesson.title,
                  orderIndex: previousLesson.orderIndex,
                }
              : null,
            previousHomeworkSummary,
            previousExamResult,
            lastPlatformExamResult,
            previousQrSummary,
          },
        });
      } catch (err) {
        console.error(
          'Error in GET /student-insights/center-dashboard/summary',
          err
        );
        next(err);
      }
    }
  );

  return router;
}

export default createStudentInsightsRouter;
