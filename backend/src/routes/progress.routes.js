// src/routes/progress.routes.js
import { Router } from 'express';

/**
 * Progress Router (بدون requireAuth):
 * - مفيش JWT إلزامي؛ بنعتمد على studentId/userId المبعوت في الـ body (لو موجود).
 * - الهدف: تسجيل الـ progress بدون ما نكسّر جلسة الطالب أو نطلعه برا.
 */

export function createProgressRouter(models) {
  const router = Router();

  const {
    LessonMysql,
    Lesson,
    StudentLessonProgressMysql,
    StudentLessonProgress,
    CourseMysql,
    Course,
  } = models;

  const LessonModel =
    LessonMysql || Lesson || models.LessonMysql || models.Lesson || null;
  const StudentLessonProgressModel =
    StudentLessonProgressMysql ||
    StudentLessonProgress ||
    models.StudentLessonProgressMysql ||
    models.StudentLessonProgress ||
    null;

  const CourseModel =
    CourseMysql || Course || models.CourseMysql || models.Course || null;

  if (!LessonModel || !StudentLessonProgressModel) {
    throw new Error(
      'Progress router: Lesson model و StudentLessonProgress model مطلوبة'
    );
  }

  // =====================================================================
  //  POST /progress/lessons/:lessonId/progress
  //      (فعلياً: /api/v1/progress/lessons/:lessonId/progress)
  // =====================================================================

  router.post('/lessons/:lessonId/progress', async (req, res, next) => {
    try {
      const lessonId = Number(req.params.lessonId);

      const {
        currentPositionSec,
        videoDurationSec,
        deviceSessionId,
        studentId: studentIdRaw,
        userId: userIdRaw,
        // NEW: هل الـ progress ده جاي من واجب؟
        isHomework: isHomeworkRaw,
      } = req.body || {};

      const studentId = Number(
        studentIdRaw !== undefined ? studentIdRaw : userIdRaw ?? 0
      );

      // لو مفيش studentId أو lessonId واضحين → نرجّع success بدون تخزين
      if (!lessonId || !Number.isFinite(lessonId) || !studentId) {
        return res.json({ success: true, data: null });
      }

      const lesson = await LessonModel.findByPk(lessonId);
      if (!lesson || lesson.isDeleted) {
        // برضه ما نرجعش 401 – نخليها 404 بس مش هتعمل logout
        return res.status(404).json({
          success: false,
          message: 'lesson not found',
        });
      }

      const now = new Date();

      const durationTotal =
        Number(
          videoDurationSec !== undefined
            ? videoDurationSec
            : lesson.durationSec ?? 0
        ) || 0;

      const newPos = Number(currentPositionSec ?? 0);

      const existing = await StudentLessonProgressModel.findOne({
        where: { studentId, lessonId },
      });

      const prevMax = existing ? Number(existing.maxWatchedSec || 0) : 0;
      const newMax = newPos > prevMax ? newPos : prevMax;

      let fullyWatched = existing ? !!existing.fullyWatched : false;
      let completedAt = existing ? existing.completedAt : null;

      if (durationTotal > 0) {
        const ratio = newMax / durationTotal;
        if (!fullyWatched && ratio >= 0.9) {
          fullyWatched = true;
          completedAt = now;
        }
      }

      // NEW: تحديد isHomework
      const isHomework =
        isHomeworkRaw !== undefined
          ? Boolean(isHomeworkRaw)
          : existing?.isHomework ?? false;

      const baseData = {
        studentId,
        lessonId,
        courseId: Number(lesson.courseId),

        // NEW
        isHomework,

        lastPositionSec: newPos,
        maxWatchedSec: newMax,
        durationSecCached: durationTotal || null,

        fullyWatched,
        completedAt,

        firstStartedAt: existing?.firstStartedAt || now,
        lastSeenAt: now,

        deviceSessionId:
          deviceSessionId ?? existing?.deviceSessionId ?? null,
        ipAddr: existing?.ipAddr || null,
        userAgent: existing?.userAgent || null,

        updatedAtLocal: now,
      };

      if (!existing) {
        const created = await StudentLessonProgressModel.create({
          ...baseData,
          createdAt: now,
        });

        return res.json({
          success: true,
          data: created.toJSON ? created.toJSON() : baseData,
        });
      } else {
        await existing.update(baseData);

        return res.json({
          success: true,
          data: existing.toJSON
            ? existing.toJSON()
            : { id: existing.id, ...baseData },
        });
      }
    } catch (e) {
      next(e);
    }
  });

  // =====================================================================
  //  GET /progress/lessons/:lessonId/progress
  //  (اختياري – حاليًا مش مستخدم من الفرونت، لكنه جاهز للاستخدام لاحقًا)
  // =====================================================================

  router.get('/lessons/:lessonId/progress', async (req, res, next) => {
    try {
      const lessonId = Number(req.params.lessonId);
      const studentId = Number(req.query.studentId ?? 0);

      if (!lessonId || !Number.isFinite(lessonId) || !studentId) {
        return res.json({ success: true, data: null });
      }

      const lesson = await LessonModel.findByPk(lessonId);
      if (!lesson || lesson.isDeleted) {
        return res.status(404).json({
          success: false,
          message: 'lesson not found',
        });
      }

      let courseTitle = null;
      if (lesson.courseId && CourseModel) {
        const course = await CourseModel.findByPk(lesson.courseId);
        if (course && !course.isDeleted) {
          courseTitle = course.title;
        }
      }

      const row = await StudentLessonProgressModel.findOne({
        where: { studentId, lessonId },
      });

      if (!row) {
        return res.json({ success: true, data: null });
      }

      const json = row.toJSON ? row.toJSON() : row;

      return res.json({
        success: true,
        data: {
          ...json,
          lessonTitle: lesson.title,
          lessonKind: lesson.kind,
          courseTitle,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export default createProgressRouter;
