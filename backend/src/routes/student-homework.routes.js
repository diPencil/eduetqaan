import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { hasEntitlement } from '../services/access.js';
import { encodeId } from '../utils/hash.js';

export default function createStudentHomeworkRouter(models) {
  const router = Router();
  const { Course, Lesson, StudentAttendance, StudentLessonOverride } = models;

  // Helpers to resolve possible Mysql aliases
  const CourseModel = Course || models.CourseMysql;
  const LessonModel = Lesson || models.LessonMysql;
  const AttendanceModel = StudentAttendance || models.StudentAttendanceMysql;
  const OverrideModel = StudentLessonOverride || models.StudentLessonOverrideMysql;

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user.id;

      // 1. Find all active courses
      const allCourses = await CourseModel.findAll({
        where: { isDeleted: false, status: 'published' }
      });

      // 2. Identify owned courses via hasEntitlement
      const ownedCourseIds = [];
      const entitlementChecks = allCourses.map(async (course) => {
        const ent = await hasEntitlement({
          models,
          studentId,
          resource: { type: 'COURSE', id: course.id }
        });
        if (ent.ok) {
          ownedCourseIds.push(course.id);
        }
      });
      await Promise.all(entitlementChecks);

      // 3. Find attended lessons from Center
      const now = new Date();
      let attendedLessonIds = [];
      if (AttendanceModel) {
        const attends = await AttendanceModel.findAll({
          where: {
            studentId,
            [Op.or]: [
              { accessExpiresAt: null },
              { accessExpiresAt: { [Op.gt]: now } }
            ]
          }
        });
        attendedLessonIds = attends.map(a => a.lessonId);
      }

      // 4. Find overridden lessons
      let overrideLessonIds = [];
      if (OverrideModel) {
        const overrides = await OverrideModel.findAll({
          where: {
            studentId,
            allowHomeworkAccess: true,
            [Op.or]: [
              { expiresAt: null },
              { expiresAt: { [Op.gt]: now } }
            ]
          }
        });
        overrideLessonIds = overrides.map(o => o.lessonId);
      }

      // 5. Query accessible Homeworks
      const homeworks = await LessonModel.findAll({
        where: {
          kind: 'homework',
          isDeleted: false,
          status: 'published',
          [Op.or]: [
            { courseId: { [Op.in]: ownedCourseIds } },
            { parentLessonId: { [Op.in]: attendedLessonIds } },
            { id: { [Op.in]: attendedLessonIds } },
            { parentLessonId: { [Op.in]: overrideLessonIds } },
            { id: { [Op.in]: overrideLessonIds } },
          ]
        },
        include: [
          {
            model: CourseModel,
            as: 'course', // Assuming association is 'course', otherwise we map manually
            required: false,
            attributes: ['id', 'title']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // 6. Map to DTO
      const data = homeworks.map((hw) => {
        const json = hw.toJSON ? hw.toJSON() : hw;
        
        // Remove stream details to be safe
        delete json.videoId;
        delete json.streamUrl;
        delete json.downloadUrl;
        delete json.resources;
        delete json.captions; // Usually not needed in card list

        return {
          id: json.id,
          secureId: encodeId(json.id),
          courseId: json.courseId,
          courseSecureId: encodeId(json.courseId),
          courseTitle: json.course?.title || json.Course?.title || '', // Handle varied alias
          title: json.title,
          description: json.description,
          durationSec: json.durationSec || 0,
          hwStatus: json.hwStatus || 'pending',
          dueDate: json.dueDate,
          createdAt: json.createdAt,
          thumbnailUrl: json.thumbnailUrl,
        };
      });

      return res.json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
