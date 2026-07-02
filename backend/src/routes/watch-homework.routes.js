import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { canAccessLesson } from '../middlewares/access.js';
import { encodeId, decodeId } from '../utils/hash.js';

export default function createWatchHomeworkRouter(models) {
  const router = Router();
  const { Course, Lesson, Exam } = models;

  // Helpers
  const CourseModel = Course || models.CourseMysql;
  const LessonModel = Lesson || models.LessonMysql;
  const ExamModel = Exam || models.ExamMysql;

  function safeJsonObject(raw) {
    if (!raw) return null;
    try {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }

  function mapResources(r) {
    if (!r) return [];
    try {
      const arr = typeof r === "string" ? JSON.parse(r) : r;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  const resolveLessonParams = async (req, res, next) => {
    try {
      const hwIdStr = req.params.id;
      let hwId = Number(hwIdStr);
      if (isNaN(hwId)) {
        hwId = decodeId(hwIdStr);
      }
      const hw = await LessonModel.findByPk(hwId);
      if (!hw || hw.isDeleted || hw.kind !== 'homework') {
        return res.status(404).json({ success: false, message: "الواجب غير موجود" });
      }
      req.body = req.body || {};
      req.body.courseId = hw.courseId;
      req.body.lessonId = hw.id;
      req.resolvedLessonId = hw.id;
      next();
    } catch (e) {
      next(e);
    }
  };

  // Route to fetch a single combined view "watchable" for a specific homework
  router.get('/:id', requireAuth, resolveLessonParams, canAccessLesson(models), async (req, res, next) => {
    try {
      // The homework ID is resolved in req.resolvedLessonId by the canAccessLesson middleware
      const hwId = req.resolvedLessonId;

      const hw = await LessonModel.findByPk(hwId, {
        include: [
          {
            model: CourseModel,
            as: "course",
          },
        ]
      });

      if (!hw) {
        return res.status(404).json({ success: false, message: "الواجب غير موجود" });
      }

      // Check if there's an exam for this lesson (homework)
      const exam = await ExamModel.findOne({
        where: {
          lessonId: hw.id,
          status: 'published',
          isDeleted: false
        }
      });

      const hwVideo = {
        id: hw.id,
        title: hw.title,
        durationSec: hw.durationSec || 0,
        isFreePreview: !!hw.isFreePreview,
        vdocipherId: null, // 🛡️ Security
        teacherNotes: hw.teacherNotes || null,
        resources: mapResources(hw.resources),
        examId: exam ? encodeId(exam.id) : null // Include Exam ID securely
      };

      const homeworkItem = {
        id: hw.id,
        title: hw.title,
        status: hw.hwStatus || "pending",
        video: hwVideo,
        resources: mapResources(hw.resources),
      };

      const watchable = {
        id: hw.courseId, // Used internally to map to course ownership logic in UI mostly
        title: hw.course?.title || '',
        topic: hw.course?.category || null,
        grade: hw.course?.level || null,
        isCourse: false,
        videos: [], // No videos for isolation
        homework: [homeworkItem], // Only this specific homework
        resources: [],
      };

      return res.json({ success: true, ...watchable }); // Just return the watchable directly like watch.routes.js does
    } catch (err) {
      console.error("[WATCH-HOMEWORK] Error", err);
      next(err);
    }
  });

  return router;
}
