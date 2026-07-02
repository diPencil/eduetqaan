// src/routes/center-attendance.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   - name: CenterAttendance
 *     description: جلسات حضور السنتر السريعة (بدء جلسة اليوم + سكان بالكود وفتح مشاهدة أونلاين للكورس كله)
 *
 * components:
 *   schemas:
 *     CenterAttendanceSimpleSession:
 *       type: object
 *       description: جلسة حضور يومية في سنتر وكورس ودرس معيّن
 *       properties:
 *         id:
 *           type: integer
 *         centerId:
 *           type: integer
 *         courseId:
 *           type: integer
 *         lessonId:
 *           type: integer
 *         level:
 *           type: string
 *           nullable: true
 *         sessionDate:
 *           type: string
 *           description: التاريخ بالصيغة YYYY-MM-DD
 *         startAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         status:
 *           type: string
 *           example: open
 *         createdByUserId:
 *           type: integer
 *           nullable: true
 *
 *     CenterAttendanceScanStudent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         studentName:
 *           type: string
 *         centerId:
 *           type: integer
 *           nullable: true
 *         centerCode:
 *           type: string
 *           nullable: true
 *
 *     CenterAttendanceScanResponse:
 *       type: object
 *       properties:
 *         session:
 *           $ref: '#/components/schemas/CenterAttendanceSimpleSession'
 *         student:
 *           $ref: '#/components/schemas/CenterAttendanceScanStudent'
 *         attendance:
 *           type: object
 *           description: سجل StudentAttendance بعد الإنشاء/التحديث
 *         alreadyPresent:
 *           type: boolean
 *           description: true لو الطالب كان مسجل حضور بالفعل لنفس اليوم
 */

const convertArabicNumerals = (str) => {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
};

export function createCenterAttendanceRouter(models) {
  const router = Router();

  const {
    AttendanceSession: AttendanceSessionMysql = models.AttendanceSession,
    Student: StudentMysql = models.Student,
    StudentAttendance: StudentAttendanceMysql = models.StudentAttendance,
    Enrollment: EnrollmentMysql = models.Enrollment,
  } = models;

  const todayDateOnly = () => new Date().toISOString().slice(0, 10);

  // ⚙️ إعدادات صلاحية المشاهدة بعد الحضور من السنتر
  const ATTENDANCE_ACCESS_HOURS = Number(
    process.env.ATTENDANCE_ACCESS_HOURS || '72'
  ); // مثلاً 3 أيام

  const parsedMaxViews = Number(process.env.ATTENDANCE_MAX_VIEWS);
  const ATTENDANCE_MAX_VIEWS = Number.isFinite(parsedMaxViews)
    ? parsedMaxViews
    : 2; // مثلاً مرتين مشاهدة

  /**
   * حقول صلاحية المشاهدة الأونلاين
   * ✅ FULL_LESSON + scope = 'course' = يفتح له الكورس كله كأنه اشترى
   */
  function buildOnlineAccessFields(now = new Date()) {
    const expiresAt = new Date(
      now.getTime() + ATTENDANCE_ACCESS_HOURS * 60 * 60 * 1000
    );

    return {
      accessMode: 'FULL_LESSON',
      accessExpiresAt: expiresAt,
      maxViews: ATTENDANCE_MAX_VIEWS >= 0 ? ATTENDANCE_MAX_VIEWS : null, // null = غير محدودة
      viewsUsed: 0,
      updatedAtLocal: now,
    };
  }

  // =============== 0) قائمة جميع الجلسات (History) ===============
  /**
   * @swagger
   * /center-attendance/sessions:
   *   get:
   *     summary: جلب قائمة جلسات الحضور السابقة
   *     tags: [CenterAttendance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: centerId
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: قائمة الجلسات
   */
  router.get(
    '/sessions',
    requireAuth,
    requireRole('teacher', 'admin'),
    async (req, res, next) => {
      try {
        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;
        const centerId = req.query.centerId ? Number(req.query.centerId) : null;

        const where = {};
        if (centerId) where.centerId = centerId;
        // لو كان "مدرس" فقط، ممكن نفلتر بالسناتر المتاحة له مستقبلاً لو محتاجين

        const sessions = await AttendanceSessionMysql.findAndCountAll({
          where,
          limit,
          offset,
          order: [['sessionDate', 'DESC'], ['startedAt', 'DESC']],
          include: [
            { model: models.Center, as: 'center', attributes: ['id', 'name'] },
            { model: models.Course, as: 'course', attributes: ['id', 'title'] },
            { model: models.Lesson, as: 'lesson', attributes: ['id', 'title'] },
          ],
        });

        return res.json({
          success: true,
          data: sessions.rows,
          total: sessions.count,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // =============== 1) بدء / استرجاع Session لليوم ===============
  /**
   * @swagger
   * /center-attendance/sessions/start:
   *   post:
   *     summary: بدء أو استرجاع جلسة حضور اليوم لنفس السنتر + الكورس + الدرس
   *     description: لو توجد جلسة بنفس centerId و courseId و lessonId و sessionDate (اليوم) يتم إرجاعها، وإلا يتم إنشاء جلسة جديدة بحالة open.
   *     tags: [CenterAttendance]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               centerId:
   *                 type: integer
   *               courseId:
   *                 type: integer
   *               lessonId:
   *                 type: integer
   *               level:
   *                 type: string
   *                 nullable: true
   *                 description: المستوى/السنة (اختياري – للتخزين فقط)
   *             required:
   *               - centerId
   *               - courseId
   *               - lessonId
   *     responses:
   *       200:
   *         description: تم إرجاع جلسة اليوم (قديمة أو جديدة)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CenterAttendanceSimpleSession'
   *       400:
   *         description: centerId أو courseId أو lessonId مفقود في الـ body
   */
  router.post(
    '/sessions/start',
    requireAuth,
    requireRole('teacher', 'admin'),
    async (req, res, next) => {
      try {
        const centerId = Number(req.body.centerId) || null;
        const courseId = Number(req.body.courseId) || null;
        const lessonId = Number(req.body.lessonId) || null;
        const level = req.body.level || null;

        if (!centerId || !courseId || !lessonId) {
          return res.status(400).json({
            success: false,
            message: 'centerId, courseId, lessonId مطلوبة في الـ body',
          });
        }

        const sessionDate = todayDateOnly();

        let session = await AttendanceSessionMysql.findOne({
          where: {
            centerId,
            courseId,
            lessonId,
            sessionDate,
          },
        });

        // لو مش موجودة، نعمل Session جديدة
        if (!session) {
          session = await AttendanceSessionMysql.create({
            centerId,
            courseId,
            lessonId,
            level,
            sessionDate,
            startedAt: new Date(),
            status: 'active',
            createdByUserId: req.user?.id || null,
          });
        }

        return res.json({
          success: true,
          data: session.toJSON ? session.toJSON() : session,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // =============== 2) اسكان بالـ centerCode داخل Session ===============
  /**
   * @swagger
   * /center-attendance/sessions/{sessionId}/scan-by-center-code:
   *   post:
   *     summary: تسجيل حضور طالب في جلسة السنتر عن طريق centerCode وفتح مشاهدة أونلاين للكورس كله
   *     description: |
   *       - يبحث عن الطالب باستخدام `centerCode`.
   *       - إن كان له حضور بنفس اليوم للكورس والدرس والسنتر → لا ينشئ سجل جديد، لكن يضمن له صلاحية أونلاين FULL_LESSON + scope='course'.
   *       - وإلا ينشئ سجل حضور جديد مع صلاحية مشاهدة أونلاين للكورس كله.
   *     tags: [CenterAttendance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم جلسة الحضور المفتوحة
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               centerCode:
   *                 type: string
   *                 description: كود الطالب في السنتر (Student.centerCode)
   *             required:
   *               - centerCode
   *     responses:
   *       200:
   *         description: تم تسجيل/تحديث حضور الطالب وفتح صلاحية المشاهدة
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CenterAttendanceScanResponse'
   *       400:
   *         description: sessionId أو centerCode مفقود أو الجلسة ليست مفتوحة
   *       404:
   *         description: جلسة الحضور غير موجودة أو الطالب غير موجود
   *       409:
   *         description: يوجد أكثر من طالب بنفس centerCode
   */
  router.post(
    '/sessions/:sessionId/scan-by-center-code',
    requireAuth,
    requireRole('teacher', 'admin'),
    async (req, res, next) => {
      try {
        const sessionId = Number(req.params.sessionId) || 0;
        const rawCode = convertArabicNumerals((req.body?.centerCode ?? '').toString().trim());

        if (!sessionId || !rawCode) {
          return res.status(400).json({
            success: false,
            message: 'sessionId في الـ URL و centerCode في الـ body مطلوبين',
          });
        }

        const session = await AttendanceSessionMysql.findByPk(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            message: 'جلسة الحضور غير موجودة',
          });
        }

        if (session.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: 'الجلسة ليست مفتوحة للحضور حالياً',
          });
        }

        // 1) الطالب بالـ centerCode (المفتاح من وجهة نظر السنتر)
        const whereStudent = { centerCode: rawCode };
        // لو حابب تربط الكود بسنتر معيّن بس، فعّل السطر التالي:
        // whereStudent.centerId = session.centerId;

        const students = await StudentMysql.findAll({
          where: whereStudent,
          limit: 2,
        });

        if (!students.length) {
          return res.status(404).json({
            success: false,
            message: 'لم يتم العثور على طالب بهذا الكود في السنتر',
          });
        }

        if (students.length > 1) {
          return res.status(409).json({
            success: false,
            message:
              'يوجد أكثر من طالب بنفس centerCode، فضلاً راجع الداتا واجعل الكود فريد.',
          });
        }

        const student = students[0];

        // 2) التحقق من وجود حضور سابق لنفس اليوم
        const sessionDate = session.sessionDate; // DATEONLY "YYYY-MM-DD"
        const startOfDay = new Date(sessionDate + 'T00:00:00.000Z');
        const endOfDay = new Date(sessionDate + 'T23:59:59.999Z');

        const existing = await StudentAttendanceMysql.findOne({
          where: {
            studentId: student.id,
            courseId: session.courseId,
            lessonId: session.lessonId
          },
          order: [['id', 'DESC']],
        });

        let attendanceRow = existing;
        let alreadyPresent = false;
        const now = new Date();

        if (existing) {
          // ✅ الطالب مسجّل حضور قبل كده في نفس اليوم
          alreadyPresent = true;

          const patch = {};

          // نخليها دايماً FULL_LESSON + scope='course'
          if (existing.accessMode !== 'FULL_LESSON') {
            patch.accessMode = 'FULL_LESSON';
          }

          // لو مفيش expiry أو منتهية، نحدّثها
          let needNewExpiry = false;
          if (!existing.accessExpiresAt) {
            needNewExpiry = true;
          } else {
            const exp = new Date(existing.accessExpiresAt);
            if (!exp.getTime || isNaN(exp.getTime()) || exp < now) {
              needNewExpiry = true;
            }
          }
          if (needNewExpiry) {
            patch.accessExpiresAt = new Date(
              now.getTime() + ATTENDANCE_ACCESS_HOURS * 60 * 60 * 1000
            );
          }

          // لو maxViews مش متضبوطة، نعيّنها حسب الإعدادات
          if (existing.maxViews == null && ATTENDANCE_MAX_VIEWS >= 0) {
            patch.maxViews = ATTENDANCE_MAX_VIEWS;
          }

          // لو viewsUsed null نخليها 0
          if (existing.viewsUsed == null) {
            patch.viewsUsed = 0;
          }

          if (Object.keys(patch).length) {
            patch.updatedAtLocal = now;
            await existing.update(patch);
          }

          attendanceRow = existing;
        } else {
          // 3) إنشاء سطر حضور جديد + صلاحية مشاهدة أونلاين للكورس كله
          const accessFields = buildOnlineAccessFields(now);

          attendanceRow = await StudentAttendanceMysql.create({
            studentId: student.id, // 👈 ده اللي canAccessLesson / my-course-access بيعتمدوا عليه
            courseId: session.courseId,
            lessonId: session.lessonId,
            centerId: session.centerId,
            attendedAt: now,
            ...accessFields,
          });
        }

        // 4) ضمان وجود Enrollment للكورس بالكامل
        if (EnrollmentMysql) {
          try {
            const enrollment = await EnrollmentMysql.findOne({
              where: {
                studentId: student.id,
                courseId: session.courseId
              }
            });
            if (!enrollment) {
              await EnrollmentMysql.create({
                studentId: student.id,
                courseId: session.courseId,
                source: 'center'
              });
            }
          } catch (enrollErr) {
            console.error('[CenterAttendance] Enrollment fix failed:', enrollErr.message);
          }
        }

        return res.json({
          success: true,
          data: {
            session: session.toJSON ? session.toJSON() : session,
            student: {
              id: student.id,
              studentName: student.studentName,
              centerId: student.centerId,
              centerCode: student.centerCode,
            },
            attendance:
              typeof attendanceRow?.toJSON === 'function'
                ? attendanceRow.toJSON()
                : attendanceRow,
            alreadyPresent,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export default createCenterAttendanceRouter;
