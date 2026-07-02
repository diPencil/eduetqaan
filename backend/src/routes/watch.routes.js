// src/routes/watch.routes.js

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { canAccessCourse } from "../middlewares/access.js";
import { decodeId } from "../utils/hash.js"; // ⚡ NEW


/**
 * راوتر مشاهدة الكورسات (Watch)
 * يبني شكل Watchable المطلوب للـ Frontend من Course + Lesson
 */
export default function createWatchRouter(models) {
  const router = Router();

  const {
    CourseMysql,
    Course,
    LessonMysql,
    Lesson,
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

  if (!CourseModel) {
    throw new Error('Course model (Course / CourseMysql) is not configured for watch routes');
  }
  if (!LessonModel) {
    throw new Error('Lesson model (Lesson / LessonMysql) is not configured for watch routes');
  }

  // Helper بسيط لتحويل instance إلى JSON عادي
  const toJson = (row) =>
    typeof row?.toJSON === "function" ? row.toJSON() : row || {};

  /**
   * GET /watch/course/:id
   * GET /api/v1/watch/course/:id
   *
   * يرجّع:
   * {
   *   id,
   *   title,
   *   topic,
   *   grade,
   *   isCourse: true,
   *   videos:    VideoItem[],
   *   homework:  HomeworkItem[],
   *   resources: LectureResource[]
   * }
   */
  router.get("/course/:id", requireAuth, canAccessCourse(models), async (req, res) => {
    try {
      let courseId = Number(req.params.id);
      
      // If not a number, try to decode it as a secure ID
      if (isNaN(courseId)) {
        courseId = decodeId(req.params.id);
      }

      if (!courseId) {
        return res.status(404).json({
          success: false,
          message: "رابط غير صالح أو كورس غير موجود",
        });
      }

      // 1) الكورس نفسه
      const course = await CourseModel.findOne({
        where: { id: courseId, isDeleted: false },
      });

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "الكورس غير موجود",
        });
      }

      const c = toJson(course);

      // 2) كل الدروس (lesson + homework)
      const lessons = await LessonModel.findAll({
        where: {
          courseId,
          isDeleted: false,
        },
        order: [
          ["orderIndex", "ASC"],
          ["id", "ASC"],
        ],
      });

      const rawLessons = lessons.map(toJson);

      // نفصل بين المحاضرات (kind=lesson) والواجبات (kind=homework)
      const lessonRows = rawLessons.filter((l) => l.kind === "lesson");
      const homeworkRows = rawLessons.filter((l) => l.kind === "homework");

      // Helper لتحويل resources من JSON عام لـ LectureResource
      const mapResources = (resources) => {
        if (!Array.isArray(resources)) return [];
        return resources.map((r, idx) => ({
          id: r.id || r.url || String(idx),
          url: r.url || null,
          label: r.title || r.label || "ملف",
          kind: r.type || r.kind || "file",
        }));
      };

      // 3) بناء قائمة الفيديوهات (VideoItem[])
      const videos = lessonRows.map((l, idx) => {
        // الفكرة: لو provider = 'vdocipher' نعتبر videoId هو VdoCipher ID
        const provider = String(l.provider || "").toLowerCase();
        const vdoId =
          provider === "vdocipher" || provider === "vdociper"
            ? l.videoId
            : null;

        return {
          id: l.id,
          title: l.title,
          durationSec: l.durationSec || 0,
          isFreePreview: !!l.isFreePreview,
          vdocipherId: null, // 🛡️ Security: Zeroed out. Use /playback/token
          teacherNotes: l.teacherNotes || null,
          resources: mapResources(l.resources),
        };
      });

      // 4) بناء قائمة الواجبات (HomeworkItem[])
      const homework = homeworkRows.map((hw) => {
        const provider = String(hw.provider || "").toLowerCase();
        const vdoId =
          provider === "vdocipher" || provider === "vdociper"
            ? hw.videoId
            : null;

        const hwVideo = {
          id: hw.id,
          title: hw.title,
          durationSec: hw.durationSec || 0,
          isFreePreview: !!hw.isFreePreview,
          vdocipherId: null, // 🛡️ Security: Zeroed out.
          teacherNotes: hw.teacherNotes || null,
          resources: mapResources(hw.resources),
        };

        return {
          id: hw.id,
          title: hw.title,
          status: hw.hwStatus || "pending", // pending | submitted | graded
          video: hwVideo,
          resources: mapResources(hw.resources),
        };
      });

      // 5) resources عامة للكورس (لو محتاج تستخدمها)
      const globalResources = []; // ممكن تجمع من course أو من كل الدروس لو حابب

      const watchable = {
        id: c.id,
        title: c.title,
        topic: c.category || null, // أو أي field مناسب عندك
        grade: c.level || null,
        isCourse: true,
        videos,
        homework,
        resources: globalResources,
      };

      return res.json(watchable);
    } catch (err) {
      console.error("[WATCH] Error in GET /course/:id", err);
      return res.status(500).json({
        success: false,
        message: "Failed to build course watch data",
      });
    }
  });

  return router;
}
