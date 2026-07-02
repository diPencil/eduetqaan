import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { normalizeLevel } from "../utils/levels.js";

/**
 * @swagger
 * tags:
 *   name: AdminExams
 *   description: إدارة الامتحانات من لوحة التحكم (Admin/User)
 */

function serializeExam(e) {
  return {
    id: e.id,
    title: e.title,
    description: e.description || "",
    level: e.level,
    category: e.category,
    grade: e.grade,
    isFree: !!e.isFree,
    status: e.status,
    durationMin: e.durationMin,
    courseId: e.courseId ?? null,
    lessonId: e.lessonId ?? null,
    questionsCount: e.getDataValue("questionsCount") ?? 0,
  };
}

function safeParseJson(text, fallback) {
  try {
    const v = JSON.parse(text);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export default function createAdminExamsRouter(models) {
  const router = Router();

  const { Exam, ExamQuestion, ExamAttempt, Student } = models;
  // Use primary MySQL models for admin routes to ensure read-after-write consistency.
  // Admins need to see their changes immediately.
  const ExamQuestionModel = ExamQuestion;
  const ExamModel = Exam;

  // ✅ Auth للجميع (admin/user)
  router.use(requireAuth);

  // =================== إنشاء امتحان جديد (Admin فقط) ===================
  router.post("/", requireRole("admin" , "supervisor", "user"), async (req, res, next) => {
    try {
      const body = req.body || {};

      const title = body.title;
      const description = body.description || "";
      const level = body.level ?? null;
      const category = body.category ?? null;

      const durationMin = body.durationMin ?? 20;
      const isFree = body.isFree ?? true;
      const status = body.status ?? "published";

      const gradeRaw = body.grade;
      const grade = normalizeLevel(gradeRaw);

      const courseId = body.courseId ? Number(body.courseId) : null;
      const lessonId = body.lessonId ? Number(body.lessonId) : null;

      if (!title) {
        return res.status(400).json({ success: false, message: "title مطلوب" });
      }
      if (!grade) {
        return res
          .status(400)
          .json({ success: false, message: "grade غير صالح" });
      }

      const now = new Date();

      const exam = await Exam.create({
        title,
        description,
        level,
        category,
        grade,
        durationMin,
        isFree: !!isFree,
        status,
        isDeleted: false,
        courseId,
        lessonId,
        createdAt: now,
        updatedAtLocal: now,
      });

      res.json({ success: true, data: { id: exam.id } });
    } catch (e) {
      next(e);
    }
  });

  // =================== تعديل امتحان (Admin فقط) ===================
  router.put("/:id", requireRole("admin"  , "supervisor", "user"), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "examId غير صالح" });
      }

      const exam = await Exam.findByPk(id);
      if (!exam) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      const body = req.body || {};

      let title = body.title ?? exam.title;
      let description = body.description ?? exam.description ?? "";
      let level = body.level ?? exam.level;
      let category = body.category ?? exam.category;
      let status = body.status ?? exam.status;

      let durationMin =
        body.durationMin != null ? Number(body.durationMin) : exam.durationMin;
      let isFree =
        typeof body.isFree === "boolean" ? body.isFree : exam.isFree;

      const grade = normalizeLevel(body.grade ?? exam.grade);

      const courseId =
        body.courseId != null ? Number(body.courseId) : exam.courseId;
      const lessonId =
        body.lessonId != null ? Number(body.lessonId) : exam.lessonId;

      if (!title)
        return res.status(400).json({ success: false, message: "title مطلوب" });
      if (!grade)
        return res
          .status(400)
          .json({ success: false, message: "grade غير صالح" });
      if (Number.isNaN(durationMin) || durationMin <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "durationMin غير صالح" });
      }

      const now = new Date();

      await exam.update({
        title,
        description,
        level,
        category,
        grade,
        durationMin,
        isFree: !!isFree,
        status,
        courseId,
        lessonId,
        updatedAtLocal: now,
      });

      return res.json({ success: true, data: serializeExam(exam) });
    } catch (e) {
      next(e);
    }
  });

  // =================== حذف امتحان (Admin فقط) ===================
  router.delete("/:id", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "examId غير صالح" });
      }

      const exam = await Exam.findByPk(id);
      if (!exam) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      await ExamQuestion.destroy({ where: { examId: id } });
      await ExamAttempt.destroy({ where: { examId: id } }).catch(() => {});
      await exam.destroy();

      return res.json({ success: true, data: { id } });
    } catch (e) {
      next(e);
    }
  });

  // =================== جلب كل الأسئلة (Admin/User) - بنك الأسئلة العالمي ===================
  router.get("/questions/all", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const q = req.query || {};
      const where = {};
      const examWhere = { isDeleted: false };

      if (q.q) {
        where.text = { [Op.like]: `%${q.q}%` };
      }
      if (q.examId) {
        where.examId = Number(q.examId);
      }
      if (q.grade) {
        const norm = normalizeLevel(q.grade);
        if (norm) examWhere.grade = norm;
      }

      const rowsArr = await ExamQuestionModel.findAll({
        where,
        include: [
          {
            model: Exam,
            as: "exam",
            where: examWhere,
            attributes: ["id", "title", "grade"],
          },
        ],
        order: [["id", "DESC"]],
      });

      const data = rowsArr.map((q) => {
        const choicesArr = safeParseJson(q.choicesJson || "[]", []);
        const normalizedChoicesArr = Array.isArray(choicesArr) ? choicesArr : [];

        const choices = normalizedChoicesArr.map((c) => String(c?.text || ""));
        const idx = normalizedChoicesArr.findIndex((c) => c?.id === q.answer);
        const correctIndex = idx >= 0 ? idx : 0;

        return {
          id: q.id,
          examId: q.examId,
          examTitle: q.exam?.title || "امتحان غير معروف",
          grade: q.exam?.grade || "غير محدد",
          text: q.text || "",
          imageUrl: q.imageUrl || null,
          choices,
          correctIndex,
          explanation: q.explanation ?? null,
        };
      });

      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  // =================== جلب أسئلة امتحان واحد (Admin/User) ===================
  router.get(
    "/:id/questions",
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const examId = Number(req.params.id);
        if (Number.isNaN(examId) || examId <= 0) {
          return res
            .status(400)
            .json({ success: false, message: "examId غير صالح" });
        }

        const exam = await Exam.findByPk(examId);
        if (!exam) {
          return res
            .status(404)
            .json({ success: false, message: "الامتحان غير موجود" });
        }

        const qRows = await ExamQuestionModel.findAll({
          where: { examId },
          order: [
            ["orderIndex", "ASC"],
            ["id", "ASC"],
          ],
        });

        const data = qRows.map((q) => {
          const choicesArr = safeParseJson(q.choicesJson || "[]", []);
          const normalizedChoicesArr = Array.isArray(choicesArr) ? choicesArr : [];

          const choices = normalizedChoicesArr.map((c) =>
            String(c?.text || "")
          );
          const idx = normalizedChoicesArr.findIndex((c) => c?.id === q.answer);
          const correctIndex = idx >= 0 ? idx : 0;

          const expObj = safeParseJson(q.explanationsJson || "null", null);
          const expMap = expObj && typeof expObj === "object" ? expObj : null;

          const choiceExplanations = normalizedChoicesArr.map((c) => {
            const id = String(c?.id || "");
            const val = expMap ? expMap[id] : "";
            return val != null ? String(val) : "";
          });

          return {
            id: q.id,
            examId: q.examId,
            text: q.text || "",
            imageUrl: q.imageUrl || null,
            choices,
            correctIndex,
            explanation: q.explanation ?? null,
            choiceExplanations,
          };
        });

        return res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  // =================== إضافة / استبدال أسئلة الامتحان (Admin فقط) ===================
  router.post("/:id/questions", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const examId = Number(req.params.id);
      if (Number.isNaN(examId) || examId <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "examId غير صالح" });
      }

      const exam = await Exam.findByPk(examId);
      if (!exam) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      const body = req.body || {};
      if (!Array.isArray(body.questions)) {
        return res.status(400).json({
          success: false,
          message: "questions يجب أن تكون مصفوفة",
        });
      }

      const questions = body.questions;
      const now = new Date();

      if (!questions.length) {
        await ExamQuestion.destroy({ where: { examId } });
        return res.json({ success: true, data: { examId, count: 0 } });
      }

      const errors = [];
      const rows = [];

      questions.forEach((q, index) => {
        const rawText = q?.text;
        const rawImageUrl = q?.imageUrl;

        const text = rawText != null ? String(rawText || "").trim() : "";
        const imageUrl =
          rawImageUrl != null && String(rawImageUrl).trim() !== ""
            ? String(rawImageUrl).trim()
            : null;

        const rawChoices = Array.isArray(q?.choices) ? q.choices : [];
        const correctIndex = Number(q?.correctIndex);
        const points = q?.points != null ? Number(q.points) : 1;

        const explanation =
          q?.explanation != null && String(q.explanation).trim() !== ""
            ? String(q.explanation).trim()
            : null;

        const rawChoiceExps = Array.isArray(q?.choiceExplanations)
          ? q.choiceExplanations
          : null;

        if (!text && !imageUrl) {
          errors.push(
            `السؤال رقم ${index + 1}: مطلوب نص للسؤال أو رابط صورة (imageUrl)`
          );
        }

        if (!rawChoices.length || rawChoices.length < 2) {
          errors.push(
            `السؤال رقم ${index + 1}: choices مطلوبة وبحد أدنى 2 اختيار`
          );
        }

        if (
          Number.isNaN(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= rawChoices.length
        ) {
          errors.push(
            `السؤال رقم ${index + 1}: correctIndex غير صالح (يجب أن يكون بين 0 و ${
              rawChoices.length - 1
            })`
          );
        }

        if (Number.isNaN(points) || points <= 0) {
          errors.push(`السؤال رقم ${index + 1}: points غير صالح`);
        }

        if (rawChoiceExps && rawChoiceExps.length !== rawChoices.length) {
          errors.push(
            `السؤال رقم ${index + 1}: choiceExplanations لازم تكون بنفس عدد choices (${rawChoices.length})`
          );
        }

        const baseCharCode = "a".charCodeAt(0);
        const choiceObjects = rawChoices.map((ch, i) => ({
          id: String.fromCharCode(baseCharCode + i),
          text: String(ch || "").trim(),
        }));

        const correctChoice = choiceObjects[correctIndex];
        if (!correctChoice) {
          errors.push(`السؤال رقم ${index + 1}: لا يمكن تحديد الاختيار الصحيح`);
          return;
        }

        let explanationsJson = null;
        if (rawChoiceExps) {
          const expMap = {};
          choiceObjects.forEach((c, i) => {
            const v = rawChoiceExps[i];
            expMap[c.id] = v != null ? String(v) : "";
          });
          explanationsJson = JSON.stringify(expMap);
        }

        rows.push({
          examId,
          text: text || "",
          imageUrl,
          choicesJson: JSON.stringify(choiceObjects),
          answer: correctChoice.id,
          explanation,
          explanationsJson,
          orderIndex: index,
          isDeleted: false,
          createdAt: now,
          updatedAtLocal: now,
        });
      });

      if (errors.length) return res.status(400).json({ success: false, errors });

      await ExamQuestion.destroy({ where: { examId } });

      const attributes = Object.keys(ExamQuestion.rawAttributes);
      const filteredRows = rows.map((r) => {
        const out = {};
        for (const k of attributes) {
          if (r[k] !== undefined) out[k] = r[k];
        }
        return out;
      });

      const created = await ExamQuestion.bulkCreate(filteredRows);

      return res.json({
        success: true,
        data: { examId, count: created.length },
      });
    } catch (e) {
      next(e);
    }
  });

  // =================== لستة الامتحانات (Admin/User) ===================
  router.get("/", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const q = req.query || {};
      const where = { isDeleted: false };

      if (q.grade && q.grade !== "undefined" && q.grade !== "null") {
        const norm = normalizeLevel(q.grade);
        if (norm) where.grade = norm;
      }

      if (q.q && q.q !== "undefined" && q.q !== "null") {
        where.title = { [Op.like]: `%${q.q}%` };
      }

      if (q.status && q.status !== "undefined" && q.status !== "null") {
        where.status = q.status;
      }

      const rows = await Exam.findAll({
        where,
        attributes: {
          include: [
            [
              Exam.sequelize.literal(`(
                SELECT COUNT(*)
                FROM exam_questions AS eq
                WHERE eq.examId = Exam.id
              )`),
              "questionsCount",
            ],
          ],
        },
        order: [["id", "DESC"]],
      });
      res.json({ success: true, data: rows.map(serializeExam) });
    } catch (e) {
      next(e);
    }
  });

  // =================== تقرير الامتحان (Admin/User) ===================
  router.get("/:id/report", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const examId = Number(req.params.id);
      if (Number.isNaN(examId) || examId <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "examId غير صالح" });
      }

      const { sequelize } = models;
      const exam = await Exam.findByPk(examId, {
        attributes: {
          include: [
            [
              sequelize.literal(`(SELECT COUNT(*) FROM exam_questions WHERE examId = Exam.id)`),
              "totalQuestions",
            ],
            [
              sequelize.literal(`(SELECT COUNT(*) FROM exam_questions WHERE examId = Exam.id)`),
              "maxScore",
            ],
          ],
        },
      });

      if (!exam) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      console.log(`[Report] Found exam: ${exam.title}, totalQuestions: ${exam.get('totalQuestions')}`);

      const rows = await ExamAttempt.findAll({
        where: { examId },
        include: [
          {
            model: Student,
            as: "student",
            attributes: ["id", "studentName", "centerCode", "studentPhone", "guardianPhone"],
          },
        ],
      });

      const examDto = {
        id: exam.id,
        title: exam.title,
        description: exam.description || "",
        year: exam.grade,
        durationMin: exam.durationMin,
        category: exam.category,
        totalQuestions: Number(exam.get('totalQuestions') || 0),
        maxScore: Number(exam.get('maxScore') || exam.get('totalQuestions') || 0),
      };

      const results = rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.student?.studentName || "طالب غير معروف",
        studentCode: r.student?.centerCode || r.studentId,
        studentPhone: r.student?.studentPhone || "-",
        guardianPhone: r.student?.guardianPhone || "-",
        examId: r.examId,
        score: r.score,
        startedAt: r.startedAt,
        submittedAt: r.submittedAt,
      }));

      return res.json({ success: true, data: { exam: examDto, results } });
    } catch (e) {
      next(e);
    }
  });

  // =================== جلب تفاصيل امتحان واحد (Admin/User) ===================
  router.get("/:id", requireRole("admin", "supervisor", "user"), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const exam = await Exam.findByPk(id, {
        attributes: {
          include: [
            [
              Exam.sequelize.literal(`(
                SELECT COUNT(*)
                FROM exam_questions AS eq
                WHERE eq.examId = Exam.id
              )`),
              "questionsCount",
            ],
          ],
        },
      });
      if (!exam) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      return res.json({ success: true, data: serializeExam(exam) });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
