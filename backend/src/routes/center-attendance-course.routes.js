// src/routes/center-attendance-course.routes.js
import { Router } from "express";
import { Op, fn, col } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { normalizeLevel } from "../utils/levels.js";

/**
 * Swagger definitions كما هي (لم ألمسها إلا بإضافة حقل previousLessonWatchedOnline)
 * ...
 */

export function createCenterAttendanceRouter(models) {
  const convertArabicNumerals = (str) => {
    return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  };
  const router = Router();

  // -----------------------------
  // Models (Mysql fallback)
  // -----------------------------
  const StudentMysql = models.StudentMysql || models.Student;
  const CenterMysql = models.CenterMysql || models.Center;
  const CourseMysql = models.CourseMysql || models.Course;
  const LessonMysql = models.LessonMysql || models.Lesson;

  const StudentAttendanceMysql =
    models.StudentAttendanceMysql || models.StudentAttendance;

  const EnrollmentMysql = models.EnrollmentMysql || models.Enrollment || null;

  const AttendanceSessionMysql =
    models.AttendanceSessionMysql || models.AttendanceSession || null;

  const LessonExamScoreMysql =
    models.LessonExamScoreMysql || models.LessonExamScore || null;

  // progress
  const StudentLessonProgressMysql =
    models.StudentLessonProgressMysql || models.StudentLessonProgress || null;

  // -----------------------------
  // Helpers
  // -----------------------------
  const DEFAULT_ACCESS_DAYS = Number(process.env.ATTEND_ACCESS_DAYS || 7);
  const DEFAULT_MAX_VIEWS = Number(process.env.ATTEND_MAX_VIEWS || 2);

  const ACCESS_MODES = new Set(["HW_ONLY", "FULL_LESSON"]);

  function safeStudent(row) {
    const j = row?.toJSON ? row.toJSON() : row || {};
    const { passwordHash, ...rest } = j;
    return rest;
  }

  function buildStudentLookupPayload(student) {
    const s = safeStudent(student);

    return {
      student: s,
      center: student.center
        ? {
            id: student.center.id,
            name: student.center.name,
            region: student.center.region,
            city: student.center.city ?? null,
          }
        : null,
      courses: [],
      ...s,
    };
  }

  function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
  }

  function parsePositiveInt(v) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function getActorUserId(req) {
    // best-effort حسب شكل requireAuth عندك
    return (
      req?.user?.id ??
      req?.user?.userId ??
      req?.auth?.id ??
      req?.auth?.userId ??
      null
    );
  }

  function normalizeAccessMode(v) {
    const raw = v == null ? null : String(v).trim().toUpperCase();
    if (!raw) return null;
    return ACCESS_MODES.has(raw) ? raw : null;
  }

  function calcProgressPercentFromRow(p) {
    const dur =
      Number(p?.durationSecCached ?? p?.durationSec ?? p?.duration ?? 0) || 0;
    if (dur <= 0) return null;

    const watched =
      Number(p?.maxWatchedSec ?? p?.lastPositionSec ?? p?.watchedSec ?? 0) || 0;

    const pct = Math.round((watched / dur) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  function pickProgressDate(p) {
    return (
      p?.updatedAtLocal ||
      p?.lastSeenAt ||
      p?.completedAt ||
      p?.createdAtLocal ||
      p?.createdAt ||
      null
    );
  }

  function buildLatestRowMapByStudentId(rows) {
    // لازم تكون rows مرتبة DESC قبل النداء
    const map = new Map();
    for (const r of rows) {
      const sid = Number(r.studentId);
      if (!sid) continue;
      if (!map.has(sid)) map.set(sid, r);
    }
    return map;
  }

  // ==== helper: ضمان وجود Enrollment للكورس بالكامل ====
  async function ensureCourseEnrollmentForStudent(studentId, courseId) {
    if (!EnrollmentMysql) return null;

    const sid = Number(studentId);
    const cid = Number(courseId);
    if (!sid || !cid) return null;

    const existing = await EnrollmentMysql.findOne({
      where: { studentId: sid, courseId: cid },
      order: [["id", "DESC"]],
    });

    if (existing) return existing;

    const now = new Date();

    const data = {
      studentId: sid,
      courseId: cid,
      source: "center",
      status: "active",
      startedAt: now,
    };

    const enrollment = await EnrollmentMysql.create(data);
    return enrollment;
  }

  // ===== helper: التأكد من أن session فعّالة قبل تسجيل الحضور (اختياري فقط الآن) =====
  async function ensureActiveSessionForMark({ centerId, lessonId, sessionId }) {
    if (!AttendanceSessionMysql) {
      return { session: null, previousSessionsCount: 0 };
    }

    const sid = Number(sessionId);
    if (!sid) {
      return { session: null, previousSessionsCount: 0 };
    }

    const session = await AttendanceSessionMysql.findByPk(sid);
    if (!session) throw httpError(404, "جلسة الحضور غير موجودة");

    if (Number(session.centerId) !== Number(centerId)) {
      throw httpError(400, "هذه الجلسة لا تخص نفس السنتر المحدد في الطلب");
    }

    if (Number(session.lessonId) !== Number(lessonId)) {
      throw httpError(400, "هذه الجلسة لا تخص نفس المحاضرة المحددة في الطلب");
    }

    if (session.status && String(session.status) !== "active") {
      throw httpError(
        400,
        "لا يمكن تسجيل الحضور على جلسة منتهية. ابدأ جلسة جديدة."
      );
    }

    const previousSessionsCount = await AttendanceSessionMysql.count({
      where: {
        centerId,
        lessonId,
        id: { [Op.lt]: session.id },
      },
    });

    return { session, previousSessionsCount };
  }

  async function getLatestStudentNote(studentId) {
    if (!StudentAttendanceMysql) return null;

    const row = await StudentAttendanceMysql.findOne({
      where: {
        studentId: Number(studentId),
        [Op.and]: [{ note: { [Op.ne]: null } }, { note: { [Op.ne]: "" } }],
      },
      order: [
        ["updatedAtLocal", "DESC"],
        ["attendedAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    if (!row) return null;

    const j = row.toJSON ? row.toJSON() : row;

    const [course, lesson] = await Promise.all([
      j.courseId
        ? CourseMysql.findByPk(j.courseId, { attributes: ["id", "title"] })
        : null,
      j.lessonId
        ? LessonMysql.findByPk(j.lessonId, { attributes: ["id", "title"] })
        : null,
    ]);

    return {
      note: j.note ?? null,
      attendanceId: j.id ?? null,
      updatedAtLocal: j.updatedAtLocal ?? null,
      attendedAt: j.attendedAt ?? null,
      courseId: j.courseId ?? null,
      courseTitle: course?.title ?? null,
      lessonId: j.lessonId ?? null,
      lessonTitle: lesson?.title ?? null,
    };
  }

  // ================== REQUIRED COURSES SUMMARY (NEW) ==================
  async function buildStudentRequiredCoursesSummary({
    studentId,
    levelNorm,
    currentCourseId = null,
  }) {
    // 1) Required courses للـ level
    const courses = await CourseMysql.findAll({
      where: { isDeleted: false, level: levelNorm },
      attributes: ["id", "title"],
      order: [["id", "ASC"]],
    });

    const requiredCourseIds = courses.map((c) => Number(c.id)).filter(Boolean);

    if (!requiredCourseIds.length) {
      return {
        requiredCourses: [],
        stats: { total: 0, present: 0, partial: 0, absent: 0 },
        previousCourseWarning: { missed: false, courseId: null, title: null },
        absentCourses: [],
      };
    }

    // 2) حضور سنتر (global) مجمّع per course
    const attendanceRows = StudentAttendanceMysql
      ? await StudentAttendanceMysql.findAll({
          where: {
            studentId: Number(studentId),
            courseId: { [Op.in]: requiredCourseIds },
          },
          attributes: [
            "courseId",
            [fn("MAX", col("attendedAt")), "lastAttendanceAt"],
          ],
          group: ["courseId"],
          raw: true,
        })
      : [];

    const presentMap = new Map(); // courseId -> lastAttendanceAt
    for (const r of attendanceRows) {
      const cid = Number(r.courseId);
      presentMap.set(cid, r.lastAttendanceAt || null);
    }

    // 3) progress أونلاين (global) -> per course
    const partialMap = new Map(); // courseId -> lastOnlineAt

    if (StudentLessonProgressMysql) {
      const lessons = await LessonMysql.findAll({
        where: { isDeleted: false, courseId: { [Op.in]: requiredCourseIds } },
        attributes: ["id", "courseId"],
        raw: true,
      });

      const lessonIdToCourseId = new Map(
        lessons.map((l) => [Number(l.id), Number(l.courseId)])
      );

      const lessonIds = lessons.map((l) => Number(l.id)).filter(Boolean);

      if (lessonIds.length) {
        const progressRows = await StudentLessonProgressMysql.findAll({
          where: {
            studentId: Number(studentId),
            lessonId: { [Op.in]: lessonIds },
          },
          raw: true,
        });

        for (const p of progressRows) {
          const lid = Number(p.lessonId);
          const cid = lessonIdToCourseId.get(lid);
          if (!cid) continue;

          const fullyWatched = !!p.fullyWatched;
          const pct = calcProgressPercentFromRow(p);
          const qualifies = fullyWatched || (pct != null && pct >= 70);
          if (!qualifies) continue;

          // لو عنده حضور سنتر للكورس ده يبقى present مش partial
          if (presentMap.has(cid)) continue;

          const pDate = pickProgressDate(p);

          const last = partialMap.get(cid);
          const cur = pDate ? new Date(pDate).getTime() : 0;
          const old = last ? new Date(last).getTime() : 0;

          if (!last || cur > old) partialMap.set(cid, pDate);
        }
      }
    }

    // 4) Build requiredCourses list + stats
    const requiredCourses = courses.map((c) => {
      const cid = Number(c.id);

      if (presentMap.has(cid)) {
        return {
          courseId: cid,
          title: c.title,
          status: "present",
          lastActivityAt: presentMap.get(cid),
        };
      }

      if (partialMap.has(cid)) {
        return {
          courseId: cid,
          title: c.title,
          status: "partial",
          lastActivityAt: partialMap.get(cid),
        };
      }

      return {
        courseId: cid,
        title: c.title,
        status: "absent",
        lastActivityAt: null,
      };
    });

    const stats = {
      total: requiredCourses.length,
      present: requiredCourses.filter((x) => x.status === "present").length,
      partial: requiredCourses.filter((x) => x.status === "partial").length,
      absent: requiredCourses.filter((x) => x.status === "absent").length,
    };

    const absentCourses = requiredCourses.filter((x) => x.status === "absent");

    // 5) تحذير الكورس السابق بالنسبة للكورس الحالي
    let previousCourseWarning = { missed: false, courseId: null, title: null };

    if (currentCourseId) {
      const idx = requiredCourses.findIndex(
        (x) => Number(x.courseId) === Number(currentCourseId)
      );
      if (idx > 0) {
        const prev = requiredCourses[idx - 1];
        if (prev?.status === "absent" || prev?.status === "partial") {
          previousCourseWarning = {
            missed: true,
            status: prev.status,
            courseId: prev.courseId,
            title: prev.title,
          };
        }
      }
    }

    return { requiredCourses, stats, previousCourseWarning, absentCourses };
  }

  // ================== 1-A) Lookup بالـ POST ==================
  router.post(
    "/lookup-student",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const raw = convertArabicNumerals(String(req.body?.centerCode || ""))
          .trim()
          .toUpperCase();

        const courseId = Number(req.body?.courseId);
        const lessonId = Number(req.body?.lessonId);

        if (!raw) {
          return res.status(400).json({
            success: false,
            message: "كود السنتر مطلوب",
          });
        }

        const student = await StudentMysql.findOne({
          where: { centerCode: raw },
          include: [{ model: CenterMysql, as: "center" }],
        });

        if (!student) {
          return res.status(404).json({
            success: false,
            message: "لم يتم العثور على طالب بهذا الكود",
          });
        }

        const latestNote = await getLatestStudentNote(student.id);

        // --- Calculate Previous Homework Summary ---
        let previousHomeworkSummary = null;
        if (courseId && lessonId && LessonMysql && StudentLessonProgressMysql) {
          try {
            const lesson = await LessonMysql.findOne({
              where: { id: lessonId, courseId, isDeleted: false },
            });

            if (lesson) {
              // previous lesson
              let previousLesson = null;

              const kind = lesson.kind || "lesson";

              if (kind === "lesson") {
                const where = {
                  courseId,
                  kind: "lesson",
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

                previousLesson = await LessonMysql.findOne({
                  where,
                  order: [
                    ["orderIndex", "DESC"],
                    ["id", "DESC"],
                  ],
                });
              } else if (lesson.parentLessonId) {
                previousLesson = await LessonMysql.findByPk(lesson.parentLessonId);
              }

              if (previousLesson) {
                const homeworks = await LessonMysql.findAll({
                  where: {
                    parentLessonId: previousLesson.id,
                    kind: "homework",
                    isDeleted: false,
                  },
                  order: [
                    ["orderIndex", "ASC"],
                    ["id", "ASC"],
                  ],
                });

                if (homeworks.length) {
                  const hwIds = homeworks.map((h) => Number(h.id)).filter(Boolean);

                  const hwProgressRows = await StudentLessonProgressMysql.findAll({
                    where: { studentId: student.id, lessonId: { [Op.in]: hwIds } },
                    raw: true,
                  });

                  const hwProgMap = new Map(
                    hwProgressRows.map((p) => [Number(p.lessonId), p])
                  );

                  const items = homeworks.map((hw) => {
                    const prog = hwProgMap.get(Number(hw.id));
                    const durationSec =
                      Number(
                        prog?.durationSecCached ??
                          prog?.durationSec ??
                          hw.durationSec ??
                          0
                      ) || 0;

                    const watchedSec =
                      Number(
                        prog?.maxWatchedSec ??
                          prog?.lastPositionSec ??
                          prog?.watchedSec ??
                          0
                      ) || 0;

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

                  previousHomeworkSummary = {
                    total: items.length,
                    watchedAnyCount: items.filter((i) => (i.watchedSec || 0) > 0)
                      .length,
                    fullyWatchedCount: items.filter((i) => i.fullyWatched).length,
                    items,
                  };
                }
              }
            }
          } catch (e) {
            console.error("Error calculating previous homework summary:", e);
          }
        }

        // --- NEW: Recent Homeworks (Submission History) ---
        let recentHomeworks = [];
        try {
          const levelNorm = normalizeLevel(student.year) || student.year;

          const studentCourses = await CourseMysql.findAll({
            where: { level: levelNorm, isDeleted: false },
            attributes: ["id", "title"],
          });

          const courseIds = studentCourses.map((c) => Number(c.id)).filter(Boolean);

          const courseMap = new Map(
            studentCourses.map((c) => [Number(c.id), c.title])
          );

          if (courseIds.length > 0 && LessonMysql && StudentLessonProgressMysql) {
            // لا تعتمد على createdAt (قد لا يكون موجود)
            const homeworkLessons = await LessonMysql.findAll({
              where: {
                kind: "homework",
                isDeleted: false,
                courseId: { [Op.in]: courseIds },
              },
              order: [["id", "DESC"]],
              limit: 20,
              attributes: ["id", "title", "courseId", "durationSec"],
            });

            if (homeworkLessons.length > 0) {
              const hwIds = homeworkLessons.map((h) => Number(h.id)).filter(Boolean);

              const progressRows = await StudentLessonProgressMysql.findAll({
                where: {
                  studentId: student.id,
                  lessonId: { [Op.in]: hwIds },
                },
                raw: true,
              });

              const progressMap = new Map(
                progressRows.map((p) => [Number(p.lessonId), p])
              );

              const WATCH_THRESHOLD = 0.5;

              const items = homeworkLessons.map((hw) => {
                const p = progressMap.get(Number(hw.id));
                const courseTitle = courseMap.get(Number(hw.courseId)) || "";

                const duration =
                  Number(p?.durationSecCached ?? p?.durationSec ?? hw.durationSec ?? 0) ||
                  0;

                const watched =
                  Number(p?.maxWatchedSec ?? p?.lastPositionSec ?? p?.watchedSec ?? 0) ||
                  0;

                const ratio = duration > 0 ? watched / duration : 0;

                let status = "missing";
                let submittedAt = null;

                if (p) {
                  if (p.fullyWatched || ratio >= WATCH_THRESHOLD) {
                    status = "submitted";
                    submittedAt = pickProgressDate(p);
                  } else if (watched > 0) {
                    status = "review";
                    submittedAt = pickProgressDate(p);
                  }
                }

                return {
                  id: Number(hw.id),
                  title: hw.title,
                  course: courseTitle,
                  status,
                  submittedAt: submittedAt
                    ? new Date(submittedAt).toISOString()
                    : null,
                };
              });

              items.sort((a, b) => {
                const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                return db - da;
              });

              recentHomeworks = items.slice(0, 5);
            }
          }
        } catch (e) {
          console.error("Error calculating recent homeworks:", e);
        }

        return res.json({
          success: true,
          data: {
            ...buildStudentLookupPayload(student),
            latestNote: latestNote || null,
            previousHomeworkSummary,
            recentHomeworks,
            lastNote: latestNote || null,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 1-B) نسخة GET القديمة ==================
  router.get(
    "/lookup-student-by-code/:code",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const raw = convertArabicNumerals(String(req.params.code || ""))
          .trim()
          .toUpperCase();

        if (!raw) {
          return res.status(400).json({
            success: false,
            message: "كود السنتر مطلوب",
          });
        }

        const student = await StudentMysql.findOne({
          where: { centerCode: raw },
          include: [{ model: CenterMysql, as: "center" }],
        });

        if (!student) {
          return res.status(404).json({
            success: false,
            message: "لم يتم العثور على طالب بهذا الكود",
          });
        }

        const latestNote = await getLatestStudentNote(student.id);

        return res.json({
          success: true,
          data: {
            ...buildStudentLookupPayload(student),
            latestNote: latestNote || null,
            lastNote: latestNote || null,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 2-A) قائمة الطلاب في (السنة/الكورس/المحاضرة) ==================
  router.get(
    "/centers/:centerId/students",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const centerId = parsePositiveInt(req.params.centerId);
        if (!centerId) {
          return res
            .status(400)
            .json({ success: false, message: "centerId غير صالح" });
        }

        const levelRaw = String(req.query.level || "").trim();
        if (!levelRaw) {
          return res
            .status(400)
            .json({ success: false, message: "المستوى الدراسي (level) مطلوب" });
        }

        const levelNorm = normalizeLevel(levelRaw);
        if (!levelNorm) {
          return res
            .status(400)
            .json({ success: false, message: "المستوى الدراسي غير صالح" });
        }

        const courseId = req.query.courseId
          ? parsePositiveInt(req.query.courseId)
          : null;
        const lessonId = req.query.lessonId
          ? parsePositiveInt(req.query.lessonId)
          : null;

        // sessionId موجود للتوافق فقط
        if ((courseId && !lessonId) || (!courseId && lessonId)) {
          return res.status(400).json({
            success: false,
            message: "لازم تبعت courseId و lessonId مع بعض",
          });
        }

        const [center, mainStudents] = await Promise.all([
          CenterMysql.findOne({ where: { id: centerId, isDeleted: false } }),
          StudentMysql.findAll({
            where: { centerId, year: levelNorm },
            include: [{ model: CenterMysql, as: "center" }],
            order: [["studentName", "ASC"]],
          }),
        ]);

        if (!center) {
          return res
            .status(404)
            .json({ success: false, message: "السنتر غير موجود" });
        }

        let course = null;
        let lesson = null;
        let previousLesson = null;
        let previousCourse = null;

        let attendanceMap = new Map();
        let prevAttendanceMap = new Map();
        let prevCourseAttendanceSet = new Set();
        let prevLessonProgressMap = new Map();
        let examScoresMap = new Map();
        let extraStudents = [];

        const sessionsSummary = {
          sessions: [],
          currentSession: null,
          activeSession: null,
          totalSessions: 0,
          previousSessionsCount: 0,
          closedSessionsCount: 0,
        };

        if (courseId && lessonId) {
          const [foundCourse, foundLesson] = await Promise.all([
            CourseMysql.findOne({ where: { id: courseId, isDeleted: false } }),
            LessonMysql.findOne({
              where: { id: lessonId, courseId, isDeleted: false },
            }),
          ]);

          if (!foundCourse) {
            return res
              .status(404)
              .json({ success: false, message: "الكورس غير موجود" });
          }
          if (!foundLesson) {
            return res.status(404).json({
              success: false,
              message: "الدرس غير موجود في هذا الكورس",
            });
          }

          course = foundCourse;
          lesson = foundLesson;

          // previous course in same level
          const levelCourses = await CourseMysql.findAll({
            where: { isDeleted: false, level: levelNorm },
            order: [["id", "ASC"]],
          });

          const idx = levelCourses.findIndex(
            (c) => Number(c.id) === Number(courseId)
          );
          if (idx > 0) previousCourse = levelCourses[idx - 1];

          // previous lesson in same course (kind=lesson فقط)
          if (lesson.orderIndex != null) {
            previousLesson = await LessonMysql.findOne({
              where: {
                courseId,
                kind: "lesson",
                isDeleted: false,
                orderIndex: { [Op.lt]: lesson.orderIndex },
              },
              order: [["orderIndex", "DESC"]],
            });
          } else {
            previousLesson = await LessonMysql.findOne({
              where: {
                courseId,
                kind: "lesson",
                isDeleted: false,
                id: { [Op.lt]: lesson.id },
              },
              order: [["id", "DESC"]],
            });
          }

          // current lesson attendance (this center)
          let attRows = [];
          if (StudentAttendanceMysql) {
            attRows = await StudentAttendanceMysql.findAll({
              where: { centerId, courseId, lessonId },
              order: [
                ["attendedAt", "DESC"],
                ["id", "DESC"],
              ],
            });

            attendanceMap = buildLatestRowMapByStudentId(attRows);

            // previous lesson attendance (global)
            if (previousLesson) {
              const prevRows = await StudentAttendanceMysql.findAll({
                where: { courseId, lessonId: previousLesson.id },
                order: [
                  ["attendedAt", "DESC"],
                  ["id", "DESC"],
                ],
              });
              prevAttendanceMap = buildLatestRowMapByStudentId(prevRows);
            }

            // previous course attendance (global any lesson)
            if (previousCourse) {
              const prevCourseRows = await StudentAttendanceMysql.findAll({
                where: { courseId: previousCourse.id },
                attributes: ["studentId"],
                raw: true,
              });
              prevCourseAttendanceSet = new Set(
                prevCourseRows.map((a) => Number(a.studentId)).filter(Boolean)
              );
            }

            // Extra students (makeup)
            const mainIds = new Set(mainStudents.map((s) => Number(s.id)));
            const attendedIds = Array.from(new Set(attRows.map((a) => Number(a.studentId))));
            const extraIds = attendedIds.filter((id) => id && !mainIds.has(id));

            if (extraIds.length) {
              extraStudents = await StudentMysql.findAll({
                where: { id: { [Op.in]: extraIds } },
                include: [{ model: CenterMysql, as: "center" }],
                order: [["studentName", "ASC"]],
              });
            }
          }

          // previous lesson progress (global)
          if (previousLesson && StudentLessonProgressMysql) {
            const studentsForProgress = [...mainStudents, ...extraStudents];
            const ids = studentsForProgress
              .map((s) => Number(s.id))
              .filter((id) => Number.isFinite(id) && id > 0);

            if (ids.length) {
              const progressRows = await StudentLessonProgressMysql.findAll({
                where: {
                  lessonId: previousLesson.id,
                  studentId: { [Op.in]: ids },
                },
                raw: true,
              });

              prevLessonProgressMap = new Map(
                progressRows.map((p) => [Number(p.studentId), p])
              );
            }
          }

          // exam scores
          if (LessonExamScoreMysql) {
            const scoreRows = await LessonExamScoreMysql.findAll({
              where: { centerId, courseId, lessonId },
            });

            examScoresMap = new Map(
              scoreRows.map((r) => [Number(r.studentId), r])
            );
          }
        }

        const allStudents = [...mainStudents, ...extraStudents];

        const getPhoneFields = (stu) => {
          const phone =
            stu.studentPhone ||
            stu.phone ||
            stu.mobile ||
            stu.whatsapp ||
            stu.phoneNumber ||
            null;

          const parentPhone =
            stu.guardianPhone ||
            stu.parentPhone ||
            stu.parentMobile ||
            stu.parentWhatsapp ||
            null;

          return { phone, parentPhone };
        };

        const resultStudents = allStudents.map((s) => {
          const sid = Number(s.id);

          const att = attendanceMap.get(sid);
          const prevAtt = previousLesson ? prevAttendanceMap.get(sid) : null;
          const prevProg = previousLesson ? prevLessonProgressMap.get(sid) : null;

          const isMakeup =
            !!s.centerId && Number(s.centerId) !== Number(centerId);

          const hasAttendance = !!att;

          // previous lesson attended anywhere
          const attendedPrev = !!prevAtt;

          // watched online threshold
          let watchedPrevOnline = false;
          if (!attendedPrev && prevProg) {
            const fullyWatched = !!prevProg.fullyWatched;
            const pct = calcProgressPercentFromRow(prevProg);
            watchedPrevOnline = fullyWatched || (pct != null && pct >= 70);
          }

          const missedPreviousLesson =
            !!previousLesson && !attendedPrev && !watchedPrevOnline;

          const missedPreviousCourse =
            !!previousCourse && !prevCourseAttendanceSet.has(sid);

          const stu = s.toJSON ? s.toJSON() : s;
          const { phone, parentPhone } = getPhoneFields(stu);

          const examScoreRow = examScoresMap.get(sid) || null;

          const examScore =
            examScoreRow && examScoreRow.score != null
              ? Number(examScoreRow.score)
              : null;

          const examMaxScore =
            examScoreRow && examScoreRow.maxScore != null
              ? Number(examScoreRow.maxScore)
              : null;

          const examIsAbsent = examScoreRow ? !!examScoreRow.isAbsent : false;
          const examNote = examScoreRow?.note || null;
          const examDate =
            examScoreRow?.examDate != null ? examScoreRow.examDate : null;

          return {
            id: s.id,
            studentName: s.studentName,
            year: s.year,
            centerCode: s.centerCode || null,
            region: s.region,

            hasAttendance,
            attendanceId: att?.id ?? null,
            attendedAt: att?.attendedAt ?? null,
            isMakeup,
            homeCenterId: s.centerId ?? null,
            homeCenterName: s.center?.name ?? null,

            // للـ Excel
            phone,
            parentPhone,
            guardianPhone: stu.guardianPhone || null,

            // previous lesson info
            missedPreviousLesson,
            previousLessonId: previousLesson ? previousLesson.id : null,
            previousLessonTitle: previousLesson ? previousLesson.title : null,
            previousLessonWatchedOnline: watchedPrevOnline,

            // previous course info
            missedPreviousCourse,
            previousCourseId: previousCourse ? previousCourse.id : null,
            previousCourseTitle: previousCourse ? previousCourse.title : null,

            // exam
            examScore,
            examMaxScore,
            examIsAbsent,
            examNote,
            examDate,

            note: att?.note ?? null,
          };
        });

        return res.json({
          success: true,
          data: {
            center: { id: center.id, name: center.name, region: center.region },
            level: levelNorm,
            totalStudents: allStudents.length,
            course: course ? { id: course.id, title: course.title } : null,
            lesson: lesson
              ? {
                  id: lesson.id,
                  title: lesson.title,
                  orderIndex: lesson.orderIndex ?? null,
                }
              : null,
            previousLesson: previousLesson
              ? {
                  id: previousLesson.id,
                  title: previousLesson.title,
                  orderIndex: previousLesson.orderIndex ?? null,
                }
              : null,
            previousCourse: previousCourse
              ? { id: previousCourse.id, title: previousCourse.title }
              : null,

            currentSession: null,

            sessionsSummary: {
              totalSessions: sessionsSummary.totalSessions,
              previousSessionsCount: sessionsSummary.previousSessionsCount,
              closedSessionsCount: sessionsSummary.closedSessionsCount,
            },

            students: resultStudents,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );


  // ================== 3) تسجيل حضور طالب ==================
  router.post(
    "/mark",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const body = req.body || {};

        const centerId = Number(body.centerId);
        const courseId = Number(body.courseId);
        const lessonId = Number(body.lessonId);

        const centerCodeRaw = String(body.centerCode || "")
          .trim()
          .toUpperCase();

        const studentIdRaw =
          body.studentId != null ? Number(body.studentId) : null;

        const sessionIdFromBody =
          body.sessionId != null && body.sessionId !== ""
            ? Number(body.sessionId)
            : null;

        // NEW: noteOnly
        const noteOnly = !!body.noteOnly;

        // NEW: note
        const noteProvided = Object.prototype.hasOwnProperty.call(body, "note");
        let note = null;
        if (noteProvided) {
          const n = body.note == null ? null : String(body.note).trim();
          note = n && n.length ? n.slice(0, 255) : null;
        }

        // NEW: accessMode
        const accessModeProvided = Object.prototype.hasOwnProperty.call(
          body,
          "accessMode"
        );
        const accessModeNorm = normalizeAccessMode(body.accessMode);

        if (
          (!centerCodeRaw && !studentIdRaw) ||
          !centerId ||
          !courseId ||
          !lessonId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "centerId, courseId, lessonId + (centerCode أو studentId) مطلوبة",
          });
        }

        if (accessModeProvided && !accessModeNorm) {
          return res.status(400).json({
            success: false,
            message: "accessMode غير صالح (HW_ONLY | FULL_LESSON)",
          });
        }

        const [center, course, lesson] = await Promise.all([
          CenterMysql.findOne({ where: { id: centerId, isDeleted: false } }),
          CourseMysql.findOne({ where: { id: courseId, isDeleted: false } }),
          LessonMysql.findOne({
            where: { id: lessonId, courseId, isDeleted: false },
          }),
        ]);

        if (!center) {
          return res.status(404).json({ success: false, message: "السنتر غير موجود" });
        }
        if (!course) {
          return res.status(404).json({ success: false, message: "الكورس غير موجود" });
        }
        if (!lesson) {
          return res.status(404).json({
            success: false,
            message: "الدرس غير موجود في هذا الكورس",
          });
        }

        if (!StudentAttendanceMysql) {
          return res.status(500).json({
            success: false,
            message:
              "ميزة الحضور غير متاحة حالياً (StudentAttendanceMysql غير مهيأ)",
          });
        }

        // session optional
        let session = null;
        let previousSessionsCount = 0;
        if (AttendanceSessionMysql && sessionIdFromBody) {
          const sessionCheck = await ensureActiveSessionForMark({
            centerId,
            lessonId,
            sessionId: sessionIdFromBody,
          });
          session = sessionCheck.session;
          previousSessionsCount = sessionCheck.previousSessionsCount;
        }

        // student
        let student = null;
        if (studentIdRaw) {
          student = await StudentMysql.findByPk(studentIdRaw, {
            include: [{ model: CenterMysql, as: "center" }],
          });
        } else {
          student = await StudentMysql.findOne({
            where: { centerCode: centerCodeRaw },
            include: [{ model: CenterMysql, as: "center" }],
          });
        }

        if (!student) {
          return res.status(404).json({
            success: false,
            message: "لم يتم العثور على طالب (studentId/centerCode)",
          });
        }

        const now = new Date();

        let attendedAt = body.attendedAt ? new Date(body.attendedAt) : now;
        if (Number.isNaN(attendedAt.getTime())) attendedAt = now;

        const accessDaysRaw =
          body.accessDays !== undefined ? Number(body.accessDays) : DEFAULT_ACCESS_DAYS;

        const accessDays =
          Number.isFinite(accessDaysRaw) && accessDaysRaw > 0
            ? accessDaysRaw
            : DEFAULT_ACCESS_DAYS;

        const maxViewsRaw =
          body.maxViews !== undefined ? Number(body.maxViews) : DEFAULT_MAX_VIEWS;

        const maxViews =
          Number.isFinite(maxViewsRaw) && maxViewsRaw >= 0
            ? maxViewsRaw
            : DEFAULT_MAX_VIEWS;

        const accessExpiresAt = new Date(attendedAt);
        accessExpiresAt.setDate(accessExpiresAt.getDate() + accessDays);

        const isMakeup =
          !!student.centerId && Number(student.centerId) !== Number(centerId);

        const existing = await StudentAttendanceMysql.findOne({
          where: {
            studentId: student.id,
            centerId,
            courseId,
            lessonId,
          },
          order: [["id", "DESC"]],
        });

        // noteOnly
        if (noteOnly) {
          if (!noteProvided) {
            return res.status(400).json({
              success: false,
              message: "note مطلوبة عند استخدام noteOnly",
            });
          }

          if (!existing) {
            return res.status(400).json({
              success: false,
              message:
                "لا يوجد حضور مسجّل لهذا الطالب في هذه المحاضرة لتحديث الملاحظة",
            });
          }

          await existing.update({
            note,
            updatedAtLocal: now,
          });

          const attPlain = existing?.toJSON?.() ?? existing ?? null;

          const homeCenter = student.center
            ? {
                id: student.center.id,
                name: student.center.name,
                region: student.center.region,
                city: student.center.city ?? null,
              }
            : null;

          return res.json({
            success: true,
            data: {
              student: safeStudent(student),
              center: { id: center.id, name: center.name },
              homeCenter,
              course: { id: course.id, title: course.title },
              lesson: { id: lesson.id, title: lesson.title },
              attendance: attPlain,
              isMakeup,
              session: null,
              sessionsSummary: { previousSessionsCount: 0 },
            },
          });
        }

        // actor
        const actorId = getActorUserId(req);

        // baseData
        const baseData = {
          studentId: student.id,
          centerId,
          courseId,
          lessonId,
          sessionId: session ? session.id : null,
          attendedAt,
          accessExpiresAt,
          maxViews,
          updatedAtLocal: now,
        };

        // accessMode: لو اتبعت نحدّثه، وإلا نسيبه default في create أو نسيبه كما هو في update
        if (accessModeProvided) baseData.accessMode = accessModeNorm;

        // recordedByUserId: على create نخزنه، وعلى update نخزنه لو كان فاضي
        if (!existing) {
          if (actorId) baseData.recordedByUserId = actorId;
        } else {
          if (!existing.recordedByUserId && actorId) {
            baseData.recordedByUserId = actorId;
          }
        }

        // note: فقط لو اتبعت
        if (noteProvided) baseData.note = note;

        let attendance;
        if (!existing) {
          attendance = await StudentAttendanceMysql.create({
            ...baseData,
            viewsUsed: 0,
            createdAtLocal: now, // لو عندك العمود ده
          });
        } else {
          await existing.update({
            ...baseData,
            viewsUsed: existing.viewsUsed || 0,
          });
          attendance = existing;
        }

        // فتح الكورس بالكامل للطالب (best effort)
        try {
          await ensureCourseEnrollmentForStudent(student.id, course.id);
        } catch (e) {
          console.error("[center-attendance-course] failed to ensure enrollment", e);
        }

        const attPlain = attendance?.toJSON?.() ?? attendance ?? null;

        const homeCenter = student.center
          ? {
              id: student.center.id,
              name: student.center.name,
              region: student.center.region,
              city: student.center.city ?? null,
            }
          : null;

        return res.json({
          success: true,
          data: {
            student: safeStudent(student),
            center: { id: center.id, name: center.name },
            homeCenter,
            course: { id: course.id, title: course.title },
            lesson: { id: lesson.id, title: lesson.title },
            attendance: attPlain,
            isMakeup,
            session: session
              ? {
                  id: session.id,
                  status: session.status || null,
                  startedAt: session.startedAt || null,
                  endedAt: session.endedAt || null,
                }
              : null,
            sessionsSummary: { previousSessionsCount },
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 3-B) تسجيل درجة امتحان المحاضرة ==================
  router.post(
    "/exam-score",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        if (!LessonExamScoreMysql) {
          return res.status(500).json({
            success: false,
            message: "نظام درجات الامتحان غير مهيأ حاليًا",
          });
        }

        const body = req.body || {};

        const centerId = Number(body.centerId);
        const courseId = Number(body.courseId);
        const lessonId = Number(body.lessonId);
        const studentId = Number(body.studentId);

        const clear = !!body.clear;

        if (!centerId || !courseId || !lessonId || !studentId) {
          return res.status(400).json({
            success: false,
            message:
              "centerId, courseId, lessonId, studentId مطلوبة لتسجيل درجة الامتحان",
          });
        }

        if (clear) {
          const existing = await LessonExamScoreMysql.findOne({
            where: { centerId, courseId, lessonId, studentId },
          });

          if (existing) await existing.destroy();

          return res.json({
            success: true,
            message: "تم مسح درجة الطالب بنجاح",
            data: null,
          });
        }

        const isAbsent = !!body.isAbsent;

        let score = null;
        let maxScore = null;

        if (!isAbsent) {
          if (body.score !== null && body.score !== undefined) {
            const s = Number(body.score);
            if (!Number.isFinite(s) || s < 0) {
              return res.status(400).json({
                success: false,
                message: "قيمة score غير صالحة",
              });
            }
            score = s;
          }

          if (body.maxScore !== null && body.maxScore !== undefined) {
            const m = Number(body.maxScore);
            if (!Number.isFinite(m) || m <= 0) {
              return res.status(400).json({
                success: false,
                message: "قيمة maxScore غير صالحة",
              });
            }
            maxScore = m;
          }

          if (score !== null && maxScore !== null && score > maxScore) {
            return res.status(400).json({
              success: false,
              message: "لا يمكن أن تكون درجة الطالب أكبر من الدرجة الكلية",
            });
          }
        }

        const examDateRaw = body.examDate ? new Date(body.examDate) : new Date();
        const examDate = Number.isNaN(examDateRaw.getTime())
          ? new Date()
          : examDateRaw;

        const note =
          typeof body.note === "string" && body.note.trim().length
            ? body.note.trim().slice(0, 255)
            : null;

        const whereKey = { centerId, courseId, lessonId, studentId };
        const now = new Date();

        let row = await LessonExamScoreMysql.findOne({ where: whereKey });

        const payload = {
          ...whereKey,
          score,
          maxScore,
          isAbsent,
          examDate,
          note,
          updatedAtLocal: now,
        };

        if (!row) {
          row = await LessonExamScoreMysql.create({
            ...payload,
            createdAtLocal: now,
          });
        } else {
          await row.update(payload);
        }

        return res.json({
          success: true,
          message: "تم حفظ درجة الطالب بنجاح",
          data: row,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 4) إلغاء تسجيل الحضور ==================
  router.delete(
    "/attendance/:attendanceId",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const attendanceId = Number(req.params.attendanceId);
        if (!attendanceId) {
          return res.status(400).json({
            success: false,
            message: "attendanceId غير صالح",
          });
        }

        if (!StudentAttendanceMysql) {
          return res.status(404).json({
            success: false,
            message: "سجل الحضور غير موجود",
          });
        }

        const existing = await StudentAttendanceMysql.findByPk(attendanceId);
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: "سجل الحضور غير موجود",
          });
        }

        await existing.destroy();

        return res.json({
          success: true,
          message: "تم إلغاء تسجيل الحضور بنجاح",
          data: { attendanceId },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 5) تقرير الغياب للمحاضرة ==================
  router.get(
    "/absence-report",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        if (!StudentMysql || !StudentAttendanceMysql) {
          return res.json({
            success: true,
            data: { absents: [], absenceCount: 0 },
          });
        }

        const centerId = req.query.centerId ? Number(req.query.centerId) : null;
        const courseId = req.query.courseId ? Number(req.query.courseId) : null;
        const lessonId = req.query.lessonId ? Number(req.query.lessonId) : null;
        const levelRaw = String(req.query.level || "").trim();

        if (!centerId || !courseId || !lessonId || !levelRaw) {
          return res.status(400).json({
            success: false,
            message: "centerId, courseId, lessonId, level مطلوبة لتقرير الغياب",
          });
        }

        const levelNorm = normalizeLevel(levelRaw);
        if (!levelNorm) {
          return res.status(400).json({
            success: false,
            message: "المستوى الدراسي غير صالح",
          });
        }

        const [center, course, lesson] = await Promise.all([
          CenterMysql.findOne({ where: { id: centerId, isDeleted: false } }),
          CourseMysql.findOne({ where: { id: courseId, isDeleted: false } }),
          LessonMysql.findOne({
            where: { id: lessonId, courseId, isDeleted: false },
          }),
        ]);

        if (!center) {
          return res.status(404).json({ success: false, message: "السنتر غير موجود" });
        }
        if (!course) {
          return res.status(404).json({ success: false, message: "الكورس غير موجود" });
        }
        if (!lesson) {
          return res.status(404).json({
            success: false,
            message: "الدرس غير موجود في هذا الكورس",
          });
        }

        const mainStudents = await StudentMysql.findAll({
          where: { centerId, year: levelNorm },
          include: [{ model: CenterMysql, as: "center" }],
          order: [["studentName", "ASC"]],
        });

        const mainIds = mainStudents.map((s) => Number(s.id)).filter(Boolean);

        if (!mainIds.length) {
          return res.json({
            success: true,
            data: {
              center: { id: center.id, name: center.name },
              level: levelNorm,
              course: { id: course.id, title: course.title },
              lesson: { id: lesson.id, title: lesson.title },
              totalStudents: 0,
              absenceCount: 0,
              absents: [],
            },
          });
        }

        // global presence
        const attRows = await StudentAttendanceMysql.findAll({
          where: {
            courseId,
            lessonId,
            studentId: { [Op.in]: mainIds },
          },
          attributes: ["studentId"],
          raw: true,
        });

        const presentIds = new Set(attRows.map((a) => Number(a.studentId)).filter(Boolean));

        const absents = mainStudents.filter((s) => !presentIds.has(Number(s.id)));

        const mappedAbsents = absents.map((s) => {
          const stu = s.toJSON ? s.toJSON() : s;

          const phone =
            stu.studentPhone || stu.phone || stu.mobile || stu.whatsapp || stu.phoneNumber || null;

          const parentPhone =
            stu.guardianPhone || stu.parentPhone || stu.parentMobile || stu.parentWhatsapp || null;

          return {
            id: stu.id,
            studentName: stu.studentName || stu.name || "طالب",
            year: stu.year || null,
            centerCode: stu.centerCode || null,
            phone,
            parentPhone,
            homeCenterName: stu.center?.name || null,
          };
        });

        return res.json({
          success: true,
          data: {
            center: { id: center.id, name: center.name },
            level: levelNorm,
            course: { id: course.id, title: course.title },
            lesson: { id: lesson.id, title: lesson.title },
            totalStudents: mainStudents.length,
            absenceCount: mappedAbsents.length,
            absents: mappedAbsents,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 6) حفظ درجات امتحان المحاضرة (Bulk) ==================
  router.post(
    "/lesson-exam-scores/bulk",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        if (!LessonExamScoreMysql) {
          return res.status(500).json({
            success: false,
            message: "جدول درجات المحاضرة (LessonExamScore) غير مهيأ في السيرفر",
          });
        }

        const body = req.body || {};
        const centerId = Number(body.centerId);
        const courseId = Number(body.courseId);
        const lessonId = Number(body.lessonId);
        const scores = Array.isArray(body.scores) ? body.scores : [];

        if (!centerId || !courseId || !lessonId) {
          return res.status(400).json({
            success: false,
            message: "centerId, courseId, lessonId مطلوبة في جسم الطلب",
          });
        }

        if (!scores.length) {
          return res.json({
            success: true,
            message: "لا توجد درجات لإرسالها",
            data: { processedCount: 0, processed: [], errors: [] },
          });
        }

        const [center, course, lesson] = await Promise.all([
          CenterMysql.findOne({ where: { id: centerId, isDeleted: false } }),
          CourseMysql.findOne({ where: { id: courseId, isDeleted: false } }),
          LessonMysql.findOne({
            where: { id: lessonId, courseId, isDeleted: false },
          }),
        ]);

        if (!center) {
          return res.status(404).json({ success: false, message: "السنتر غير موجود" });
        }
        if (!course) {
          return res.status(404).json({ success: false, message: "الكورس غير موجود" });
        }
        if (!lesson) {
          return res.status(404).json({
            success: false,
            message: "الدرس غير موجود في هذا الكورس",
          });
        }

        const now = new Date();
        const processed = [];
        const errors = [];

        for (const row of scores) {
          const studentId = Number(row.studentId);
          if (!studentId) continue;

          const baseWhere = { studentId, centerId, courseId, lessonId };

          // 1. Check if user wants to clear the score completely (frontend can pass clear: true or we infer it)
          const clear = !!row.clear;
          
          if (clear) {
            const existing = await LessonExamScoreMysql.findOne({ where: baseWhere });
            if (existing) {
              await existing.destroy();
              processed.push({ studentId, action: "deleted", id: existing.id });
            }
            continue;
          }

          const isAbsent = !!row.isAbsent;
          let score = null;
          let maxScore = null;

          // 2. Validate scores if not absent
          if (!isAbsent) {
            if (row.score !== null && row.score !== undefined && row.score !== "") {
              const s = Number(row.score);
              if (!Number.isFinite(s) || s < 0) {
                errors.push({ studentId, error: "قيمة الدرجة غير صالحة" });
                continue;
              }
              score = s;
            }

            if (row.maxScore !== null && row.maxScore !== undefined && row.maxScore !== "") {
              const m = Number(row.maxScore);
              if (!Number.isFinite(m) || m <= 0) {
                errors.push({ studentId, error: "قيمة الدرجة الكلية غير صالحة" });
                continue;
              }
              maxScore = m;
            }

            if (score !== null && maxScore !== null && score > maxScore) {
              errors.push({ studentId, error: "الدرجة أكبر من الدرجة الكلية" });
              continue;
            }

            // If empty fields (and not absent), skip saving or clear it
            if (score === null && maxScore === null) {
              const existing = await LessonExamScoreMysql.findOne({ where: baseWhere });
              if (existing) {
                await existing.destroy();
                processed.push({ studentId, action: "deleted", id: existing.id });
              }
              continue;
            }
            
            if (score === null || maxScore === null) {
              errors.push({ studentId, error: "يجب إدخال الدرجة والدرجة الكلية معاً" });
              continue;
            }
          }

          const note = typeof row.note === "string" && row.note.trim().length ? row.note.trim().slice(0, 255) : null;

          let existingScore = await LessonExamScoreMysql.findOne({
            where: baseWhere,
            order: [["id", "DESC"]],
          });

          const payload = {
            ...baseWhere,
            score,
            maxScore,
            isAbsent,
            note,
            updatedAtLocal: now,
          };

          if (!existingScore) {
            existingScore = await LessonExamScoreMysql.create({ ...payload, createdAtLocal: now });
            processed.push({ studentId, action: "created", id: existingScore.id });
          } else {
            await existingScore.update(payload);
            processed.push({ studentId, action: "updated", id: existingScore.id });
          }
        }

        return res.json({
          success: true,
          message: "تم حفظ درجات امتحان المحاضرة بنجاح",
          data: { processedCount: processed.length, processed, errors },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 7) آخر نتائج امتحان لطالب ==================
  router.get(
    "/students/:studentId/lesson-exam-scores",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        if (!LessonExamScoreMysql) {
          return res.json({
            success: true,
            data: { student: null, count: 0, scores: [] },
          });
        }

        const studentId = Number(req.params.studentId);
        if (!studentId) {
          return res.status(400).json({ success: false, message: "studentId غير صالح" });
        }

        const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : 5;
        const limit = Math.min(50, Math.max(1, limitRaw || 5));

        const student = await StudentMysql.findByPk(studentId, {
          include: [{ model: CenterMysql, as: "center", required: false }],
        });
        if (!student) {
          return res.status(404).json({ success: false, message: "الطالب غير موجود" });
        }

        const rows = await LessonExamScoreMysql.findAll({
          where: { studentId },
          order: [
            ["examDate", "DESC"],
            ["id", "DESC"],
          ],
          limit,
        });

        const centerIds = Array.from(
          new Set(rows.map((r) => Number(r.centerId || 0)).filter((id) => id > 0))
        );
        const courseIds = Array.from(
          new Set(rows.map((r) => Number(r.courseId || 0)).filter((id) => id > 0))
        );
        const lessonIds = Array.from(
          new Set(rows.map((r) => Number(r.lessonId || 0)).filter((id) => id > 0))
        );

        const [centers, courses, lessons] = await Promise.all([
          centerIds.length
            ? CenterMysql.findAll({ where: { id: { [Op.in]: centerIds } } })
            : Promise.resolve([]),
          courseIds.length
            ? CourseMysql.findAll({ where: { id: { [Op.in]: courseIds } } })
            : Promise.resolve([]),
          lessonIds.length
            ? LessonMysql.findAll({ where: { id: { [Op.in]: lessonIds } } })
            : Promise.resolve([]),
        ]);

        const centersMap = new Map(centers.map((c) => [Number(c.id), c]));
        const coursesMap = new Map(courses.map((c) => [Number(c.id), c]));
        const lessonsMap = new Map(lessons.map((l) => [Number(l.id), l]));

        const scores = rows.map((r) => {
          const j = r.toJSON ? r.toJSON() : r;

          const cid = j.centerId != null ? Number(j.centerId) : null;
          const cId = j.courseId != null ? Number(j.courseId) : null;
          const lId = j.lessonId != null ? Number(j.lessonId) : null;

          const center = cid ? centersMap.get(cid) : null;
          const course = cId ? coursesMap.get(cId) : null;
          const lesson = lId ? lessonsMap.get(lId) : null;

          return {
            id: j.id,
            centerId: cid,
            centerName: center ? center.name : null,

            courseId: cId,
            courseTitle: course ? course.title : null,

            lessonId: lId,
            lessonTitle: lesson ? lesson.title : null,

            attendanceId: j.attendanceId ?? null,
            score: j.score != null ? Number(j.score) : null,
            maxScore: j.maxScore != null ? Number(j.maxScore) : null,
            isAbsent: !!j.isAbsent,
            note: j.note ?? null,
            examDate: j.examDate ?? null,

            createdAt: j.createdAtLocal ?? j.createdAt ?? null,
            updatedAt: j.updatedAtLocal ?? j.updatedAt ?? null,
          };
        });

        return res.json({
          success: true,
          data: {
            student: safeStudent(student),
            count: scores.length,
            scores,
          },
        });
      } catch (err) {
        console.error(
          "[center-attendance-course] GET /students/:studentId/lesson-exam-scores error",
          err
        );

        return res.json({
          success: true,
          data: { student: null, count: 0, scores: [] },
        });
      }
    }
  );

  // ================== 8) Required courses summary لطالب (NEW) ==================
  router.get(
    "/students/:studentId/required-courses-summary",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const studentId = Number(req.params.studentId);
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: "studentId غير صالح" });
        }

        const student = await StudentMysql.findByPk(studentId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: "الطالب غير موجود" });
        }

        const levelRaw = String(req.query.level || student.year || "").trim();
        const levelNorm = normalizeLevel(levelRaw);
        if (!levelNorm) {
          return res
            .status(400)
            .json({ success: false, message: "المستوى الدراسي غير صالح" });
        }

        const currentCourseId = req.query.currentCourseId
          ? Number(req.query.currentCourseId)
          : null;

        const summary = await buildStudentRequiredCoursesSummary({
          studentId,
          levelNorm,
          currentCourseId,
        });

        return res.json({
          success: true,
          data: {
            student: safeStudent(student),
            level: levelNorm,
            requiredCourses: summary.requiredCourses,
            requiredCoursesStats: summary.stats,
            previousCourseWarning: summary.previousCourseWarning,
            absentCourses: summary.absentCourses,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 9) نقل حضور طالب مفرد ==================
  router.post(
    "/attendance/:attendanceId/move",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const attId = Number(req.params.attendanceId);
        const newCenterId = Number(req.body.newCenterId);

        if (!attId || !newCenterId) {
          return res.status(400).json({
            success: false,
            message: "معرف الحضور ومعرف السنتر الجديد مطلوبان",
          });
        }

        const attendance = await StudentAttendanceMysql.findByPk(attId);
        if (!attendance) {
          return res.status(404).json({
            success: false,
            message: "سجل الحضور غير موجود",
          });
        }

        const targetCenter = await CenterMysql.findByPk(newCenterId);
        if (!targetCenter) {
          return res.status(404).json({
            success: false,
            message: "السنتر المحول إليه غير موجود",
          });
        }

        if (Number(attendance.centerId) === newCenterId) {
          return res.status(400).json({
            success: false,
            message: "الطالب مسجل بالفعل في هذا السنتر لهذه المحاضرة",
          });
        }

        await attendance.update({ centerId: newCenterId });

        return res.json({
          success: true,
          message: "تم نقل الحضور بنجاح",
          data: attendance,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ================== 10) نقل حضور جماعي ==================
  router.post(
    "/attendance/move-all",
    requireAuth,
    requireRole("user", "admin"),
    async (req, res, next) => {
      try {
        const { oldCenterId, courseId, lessonId, newCenterId } = req.body;

        if (!oldCenterId || !courseId || !lessonId || !newCenterId) {
          return res.status(400).json({
            success: false,
            message:
              "جميع المعرفات مطلوبة (oldCenterId, courseId, lessonId, newCenterId)",
          });
        }

        if (Number(oldCenterId) === Number(newCenterId)) {
          return res.status(400).json({
            success: false,
            message: "لا يمكن النقل لنفس السنتر",
          });
        }

        const targetCenter = await CenterMysql.findByPk(newCenterId);
        if (!targetCenter) {
          return res.status(404).json({
            success: false,
            message: "السنتر المحول إليه غير موجود",
          });
        }

        const [updatedCount] = await StudentAttendanceMysql.update(
          { centerId: newCenterId },
          {
            where: {
              centerId: oldCenterId,
              courseId,
              lessonId,
            },
          }
        );

        return res.json({
          success: true,
          message: `تم نقل ${updatedCount} سجل حضور بنجاح`,
          updatedCount,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export default createCenterAttendanceRouter;
