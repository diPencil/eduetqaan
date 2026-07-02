// src/routes/exams.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { normalizeLevel } from "../utils/levels.js";
import { requireRole } from "../middlewares/roles.js";
import { encodeId, decodeId } from "../utils/hash.js"; // ⚡ NEW

/**
 * @swagger
 * tags:
 *   - name: Exams
 *     description: إدارة الامتحانات (إنشاء من الأدمن) وحلّها ومراجعتها من قِبل الطلاب
 *
 * components:
 *   schemas:
 *     ExamListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         level:
 *           type: string
 *           nullable: true
 *         category:
 *           type: string
 *           nullable: true
 *         grade:
 *           type: string
 *           nullable: true
 *         durationMin:
 *           type: integer
 *         questionsCount:
 *           type: integer
 *         attempted:
 *           type: boolean
 *         score:
 *           type: integer
 *           nullable: true
 *         isFree:
 *           type: boolean
 *
 *     ExamListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExamListItem'
 *
 *     ExamChoice:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         text:
 *           type: string
 *
 *     ExamQuestionPublic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         text:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         choices:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExamChoice'
 *         explanation:
 *           type: string
 *           nullable: true
 *           description: تفسير عام للسؤال (اختياري)
 *         choiceExplanations:
 *           type: object
 *           nullable: true
 *           additionalProperties:
 *             type: string
 *           description: "تفسير لكل اختيار (Map: choiceId -> explanation) (اختياري)"
 *
 *     ExamQuestionReview:
 *       allOf:
 *         - $ref: '#/components/schemas/ExamQuestionPublic'
 *         - type: object
 *           properties:
 *             answer:
 *               type: string
 *               nullable: true
 *
 *     ExamDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         level:
 *           type: string
 *           nullable: true
 *         category:
 *           type: string
 *           nullable: true
 *         grade:
 *           type: string
 *           nullable: true
 *         durationMin:
 *           type: integer
 *         isFree:
 *           type: boolean
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExamQuestionPublic'
 *
 *     ExamDetailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/ExamDetail'
 *
 *     StartAttemptResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             attemptId:
 *               type: integer
 *
 *     SaveAnswerRequest:
 *       type: object
 *       required:
 *         - qid
 *         - answer
 *       properties:
 *         qid:
 *           type: string
 *         answer:
 *           type: string
 *
 *     SubmitResult:
 *       type: object
 *       properties:
 *         score:
 *           type: integer
 *
 *     SubmitResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/SubmitResult'
 *
 *     ReviewItem:
 *       type: object
 *       properties:
 *         question:
 *           $ref: '#/components/schemas/ExamQuestionReview'
 *         userAnswer:
 *           type: string
 *           nullable: true
 *         isCorrect:
 *           type: boolean
 *
 *     ReviewResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             score:
 *               type: integer
 *             review:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReviewItem'
 *
 *     CreateExamRequest:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         category:
 *           type: string
 *         grade:
 *           type: string
 *         level:
 *           type: string
 *         durationMin:
 *           type: integer
 *         isFree:
 *           type: boolean
 *         status:
 *           type: string
 *           description: draft | published (افتراضي draft)
 *
 *     BulkQuestionItem:
 *       type: object
 *       required:
 *         - text
 *         - choices
 *         - answer
 *       properties:
 *         text:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         choices:
 *           type: array
 *           items:
 *             type: string
 *         answer:
 *           type: string
 *         explanation:
 *           type: string
 *           nullable: true
 *           description: تفسير عام للسؤال (اختياري)
 *         choiceExplanations:
 *           type: object
 *           nullable: true
 *           additionalProperties:
 *             type: string
 *           description: "تفسير لكل اختيار (Map: choiceId -> explanation) (اختياري)"
 *         orderIndex:
 *           type: integer
 *           description: اختياري، لو لم يُرسل سيتم الترتيب تلقائيًا
 *
 *     BulkQuestionsRequest:
 *       type: object
 *       required:
 *         - questions
 *       properties:
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BulkQuestionItem'
 */

export default function createExamsRouter(models) {
  const router = Router();

  const modelsSafe = models || {};

  const {
    ExamMysql,
    Exam,
    ExamQuestionMysql,
    ExamQuestion,
    ExamAttemptMysql,
    ExamAttempt,
    StudentMysql,
    Student,
  } = modelsSafe;

  // موديلات موحّدة تدعم كل التسميات المحتملة (Exam / ExamMysql / Student / StudentMysql)
  const ExamModel =
    ExamMysql ||
    Exam ||
    modelsSafe.ExamMysql ||
    modelsSafe.Exam ||
    null;

  const ExamQuestionModel =
    ExamQuestionMysql ||
    ExamQuestion ||
    modelsSafe.ExamQuestionMysql ||
    modelsSafe.ExamQuestion ||
    null;

  const ExamAttemptModel =
    ExamAttemptMysql ||
    ExamAttempt ||
    modelsSafe.ExamAttemptMysql ||
    modelsSafe.ExamAttempt ||
    null;

  const StudentModel =
    StudentMysql ||
    Student ||
    modelsSafe.StudentMysql ||
    modelsSafe.Student ||
    null;

  if (!ExamModel) {
    throw new Error("Exam model (Exam / ExamMysql) is not configured");
  }
  if (!ExamQuestionModel) {
    throw new Error(
      "ExamQuestion model (ExamQuestion / ExamQuestionMysql) is not configured"
    );
  }
  if (!ExamAttemptModel) {
    throw new Error(
      "ExamAttempt model (ExamAttempt / ExamAttemptMysql) is not configured"
    );
  }
  if (!StudentModel) {
    throw new Error(
      "Student model (Student / StudentMysql) is not configured"
    );
  }

  // ============ Helpers ============

  function safeJsonObject(raw) {
    if (!raw) return null;
    try {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }

  const pickPublicQuestion = (q) => {
    const raw = JSON.parse(q.choicesJson || "[]");
    const choices = toChoiceObjects(raw);
    return {
      id: String(q.id),
      text: q.text,
      imageUrl: q.imageUrl || null,
      choices,

      // ✅ NEW (اختياري): تفسير السؤال + تفسير لكل اختيار
      explanation: q.explanation || null,
      choiceExplanations: safeJsonObject(q.choiceExplanationsJson),
    };
  };

  const pickReviewQuestion = (q) => {
    const raw = JSON.parse(q.choicesJson || "[]");
    const choices = toChoiceObjects(raw);
    const answer = answerIdFrom(choices, q.answer);
    return {
      id: String(q.id),
      text: q.text,
      imageUrl: q.imageUrl || null,
      choices,
      answer,

      // ✅ NEW (اختياري): تفسير السؤال + تفسير لكل اختيار
      explanation: q.explanation || null,
      choiceExplanations: safeJsonObject(q.choiceExplanationsJson),
    };
  };

  function toChoiceObjects(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length && typeof arr[0] === "object" && arr[0] && "id" in arr[0]) {
      return arr;
    }
    return arr.map((t, i) => ({ id: String(i + 1), text: String(t) }));
  }

  function answerIdFrom(choices, dbAnswer) {
    if (dbAnswer == null) return null;
    const str = String(dbAnswer);
    if (choices.some((c) => c.id === str)) return str;
    const hit = choices.find((c) => c.text === str);
    return hit ? hit.id : str;
  }

  function isAdminReq(req) {
    return String(req.user?.role || "").toLowerCase() === "admin";
  }

  // ============ 1) قائمة الامتحانات ============

  /**
   * @swagger
   * /exams:
   *   get:
   *     summary: عرض قائمة الامتحانات المتاحة للطالب (أو فلترة للأدمن)
   *     description: |
   *       - الطالب يرى فقط الامتحانات المنشورة لسِنته الدراسية (grade)  
   *       - الأدمن يمكنه الفلترة بـ grade / level / category
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: فلترة حسب تصنيف الامتحان (اختياري)
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: مستوى عام (اختياري)
   *       - in: query
   *         name: grade
   *         schema:
   *           type: string
   *         description: سنة دراسية (للأدمن فقط، الطالب تُستخدم سنته من البروفايل)
   *     responses:
   *       200:
   *         description: قائمة الامتحانات
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ExamListResponse'
   *       401:
   *         description: غير مصرح
   */
  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const admin = isAdminReq(req);

      const student = await StudentModel.findByPk(req.user.id);

      const where = {
        status: "published",
        isDeleted: false,
      };

      if (req.query.category) where.category = req.query.category;
      if (req.query.level) where.level = req.query.level;

      if (!admin) {
        if (!student) {
          return res
            .status(401)
            .json({ success: false, message: "حساب غير صالح" });
        }

        const studentGradeNorm = normalizeLevel(student.year) || null;

        if (!studentGradeNorm) {
          return res.status(403).json({
            success: false,
            message:
              "لا يمكن تحديد سنتك الدراسية. يرجى استكمال بيانات الحساب لتظهر لك امتحانات سنتك.",
          });
        }

        where.grade = studentGradeNorm;
      } else {
        if (req.query.grade) {
          where.grade =
            normalizeLevel(req.query.grade) || req.query.grade || null;
        }
      }

      const exams = await ExamModel.findAll({
        where,
        order: [["id", "DESC"]],
      });
      const ids = exams.map((e) => e.id);

      let qCountMap = new Map();
      if (ids.length) {
        const qCountRaw = await ExamQuestionModel.findAll({
          attributes: [
            "examId",
            [
              ExamQuestionModel.sequelize.fn(
                "COUNT",
                ExamQuestionModel.sequelize.col("id")
              ),
              "cnt",
            ],
          ],
          where: { examId: ids },
          group: ["examId"],
        });
        qCountMap = new Map(
          qCountRaw.map((r) => [r.examId, Number(r.get("cnt"))])
        );
      }

      const attempts = ids.length
        ? await ExamAttemptModel.findAll({
            where: { examId: ids, studentId: req.user.id },
          })
        : [];
      const attemptMap = new Map(attempts.map((a) => [a.examId, a]));

      const data = exams.map((e) => ({
        id: String(e.id),
        secureId: encodeId(e.id), // ⚡ NEW
        title: e.title,
        description: e.description || "",
        level: e.level || null,
        category: e.category || null,
        grade: normalizeLevel(e.grade) || e.grade || null,
        durationMin: e.durationMin || 0,
        questionsCount: qCountMap.get(e.id) || 0,
        attempted: !!attemptMap.get(e.id)?.submittedAt,
        score: attemptMap.get(e.id)?.score ?? null,
        isFree: !!e.isFree,
      }));

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  // ============ 2) تفاصيل امتحان واحد ============

  /**
   * @swagger
   * /exams/{id}:
   *   get:
   *     summary: تفاصيل امتحان واحد + الأسئلة (بدون حلول)
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     responses:
   *       200:
   *         description: تفاصيل الامتحان والأسئلة
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ExamDetailResponse'
   *       404:
   *         description: الامتحان غير موجود
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: الطالب في سنة مختلفة عن الامتحان
   */
  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      let id = Number(req.params.id);
      if (isNaN(id)) {
        id = decodeId(req.params.id);
      }

      const exam = await ExamModel.findByPk(id);
      if (!exam || exam.isDeleted || exam.status !== "published") {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      const admin = isAdminReq(req);
      const student = await StudentModel.findByPk(req.user.id);

      const examGradeNorm = normalizeLevel(exam.grade) || exam.grade;
      const studentGradeNorm = normalizeLevel(student?.year) || student?.year;

      if (!admin) {
        if (!student) {
          return res
            .status(401)
            .json({ success: false, message: "حساب غير صالح" });
        }

        if (examGradeNorm && examGradeNorm !== studentGradeNorm) {
          return res.status(403).json({
            success: false,
            code: "GRADE_MISMATCH",
            message: "هذا الامتحان مخصص لسنة دراسية مختلفة عن حسابك.",
          });
        }
      }

      const qs = await ExamQuestionModel.findAll({
        where: { examId: id },
        order: [
          ["orderIndex", "ASC"],
          ["id", "ASC"],
        ],
      });

      const data = {
        id: String(exam.id),
        title: exam.title,
        description: exam.description || "",
        level: exam.level || null,
        category: exam.category || null,
        grade: examGradeNorm || null,
        durationMin: exam.durationMin || 0,
        isFree: !!exam.isFree,
        secureId: encodeId(exam.id),
        questions: qs.map(pickPublicQuestion),
      };

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  // ============ 3) بدء محاولة ============

  /**
   * @swagger
   * /exams/{id}/attempt:
   *   post:
   *     summary: بدء محاولة جديدة لامتحان (أو استكمال محاولة غير مُسلَّمة)
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     responses:
   *       200:
   *         description: تم إنشاء/استرجاع المحاولة
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StartAttemptResponse'
   *       404:
   *         description: الامتحان غير موجود
   *       401:
   *         description: غير مصرح
   *       403:
   *         description: الطالب في سنة مختلفة عن الامتحان
   *       409:
   *         description: تم تسليم هذا الامتحان من قبل
   */
  router.post("/:id/attempt", requireAuth, async (req, res, next) => {
    try {
      let examId = Number(req.params.id);
      if (isNaN(examId)) {
        examId = decodeId(req.params.id);
      }
      const exam = await ExamModel.findByPk(examId);

      if (!exam || exam.isDeleted || exam.status !== "published") {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      const admin = isAdminReq(req);
      const student = await StudentModel.findByPk(req.user.id);

      const examGradeNorm = normalizeLevel(exam.grade) || exam.grade;
      const studentGradeNorm = normalizeLevel(student?.year) || student?.year;

      if (!admin) {
        if (!student) {
          return res
            .status(401)
            .json({ success: false, message: "حساب غير صالح" });
        }

        if (examGradeNorm && examGradeNorm !== studentGradeNorm) {
          return res.status(403).json({
            success: false,
            code: "GRADE_MISMATCH",
            message: "هذا الامتحان مخصص لسنة دراسية مختلفة عن حسابك.",
          });
        }
      }

      let attempt = await ExamAttemptModel.findOne({
        where: { examId, studentId: req.user.id },
      });

      if (attempt?.submittedAt) {
        return res
          .status(409)
          .json({ success: false, message: "تمت المحاولة من قبل" });
      }

      if (!attempt) {
        attempt = await ExamAttemptModel.create({
          examId,
          studentId: req.user.id,
          answersJson: "[]",
          startedAt: new Date(),
          updatedAtLocal: new Date(),
        });
      }

      res.json({ success: true, data: { attemptId: attempt.id } });
    } catch (e) {
      next(e);
    }
  });

  // ============ 4) حفظ إجابة ============

  /**
   * @swagger
   * /exams/{id}/answer:
   *   post:
   *     summary: حفظ إجابة سؤال واحد أثناء الامتحان
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SaveAnswerRequest'
   *     responses:
   *       200:
   *         description: تم حفظ الإجابة بنجاح
   *       400:
   *         description: بيانات ناقصة أو لا توجد محاولة نشطة
   *       401:
   *         description: غير مصرح
   */
  router.post("/:id/answer", requireAuth, async (req, res, next) => {
    try {
      let examId = Number(req.params.id);
      if (isNaN(examId)) {
        examId = decodeId(req.params.id);
      }
      const { qid, answer } = req.body || {};
      if (!qid || typeof answer !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const attempt = await ExamAttemptModel.findOne({
        where: { examId, studentId: req.user.id },
      });
      if (!attempt || attempt.submittedAt) {
        return res
          .status(400)
          .json({ success: false, message: "لا توجد محاولة نشطة" });
      }

      const arr = JSON.parse(attempt.answersJson || "[]");
      const idx = arr.findIndex((x) => String(x.qid) === String(qid));
      if (idx >= 0) arr[idx].answer = answer;
      else arr.push({ qid, answer });

      const newJson = JSON.stringify(arr);

      await attempt.update({
        answersJson: newJson,
        updatedAtLocal: new Date(),
      });

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  // ============ 5) تسليم الامتحان ============

  /**
   * @swagger
   * /exams/{id}/submit:
   *   post:
   *     summary: تسليم الامتحان واحتساب الدرجة
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     responses:
   *       200:
   *         description: تم التسليم، يتم إرجاع الدرجة
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SubmitResponse'
   *       400:
   *         description: لا توجد محاولة
   *       401:
   *         description: غير مصرح
   */
  router.post("/:id/submit", requireAuth, async (req, res, next) => {
    try {
      let examId = Number(req.params.id);
      if (isNaN(examId)) {
        examId = decodeId(req.params.id);
      }

      const attempt = await ExamAttemptModel.findOne({
        where: { examId, studentId: req.user.id },
      });
      if (!attempt) {
        return res
          .status(400)
          .json({ success: false, message: "لا توجد محاولة" });
      }
      if (attempt.submittedAt) {
        return res.json({
          success: true,
          data: { score: attempt.score ?? 0 },
        });
      }

      const qs = await ExamQuestionModel.findAll({
        where: { examId },
        order: [
          ["orderIndex", "ASC"],
          ["id", "ASC"],
        ],
      });

      const answers = new Map(
        JSON.parse(attempt.answersJson || "[]").map((x) => [
          String(x.qid),
          String(x.answer),
        ])
      );

      let correct = 0;
      for (const q of qs) {
        const raw = JSON.parse(q.choicesJson || "[]");
        const choices = toChoiceObjects(raw);
        const correctId = answerIdFrom(choices, q.answer);
        const userAns = answers.get(String(q.id));
        if (!userAns) continue;

        if (
          userAns === correctId ||
          choices.find((c) => c.id === userAns)?.text === q.answer
        ) {
          correct++;
        }
      }

      const score = qs.length ? Math.round((correct / qs.length) * 100) : 0;

      const submittedAt = new Date();
      await attempt.update({
        submittedAt,
        score,
        updatedAtLocal: new Date(),
      });

      res.json({ success: true, data: { score } });
    } catch (e) {
      next(e);
    }
  });

  // ============ 6) مراجعة الامتحان ============

  /**
   * @swagger
   * /exams/{id}/review:
   *   get:
   *     summary: مراجعة الامتحان بعد التسليم (الأسئلة + إجابة الطالب + مدى الصحة)
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     responses:
   *       200:
   *         description: نتيجة المراجعة
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ReviewResponse'
   *       403:
   *         description: لا توجد محاولة مُسلَّمة
   *       401:
   *         description: غير مصرح
   */
  router.get("/:id/review", requireAuth, async (req, res, next) => {
    try {
      let examId = Number(req.params.id);
      if (isNaN(examId)) {
        examId = decodeId(req.params.id);
      }

      const attempt = await ExamAttemptModel.findOne({
        where: { examId, studentId: req.user.id },
      });
      if (!attempt || !attempt.submittedAt) {
        return res.status(403).json({
          success: false,
          message: "لا توجد محاولة مُسلَّمة",
        });
      }

      const qs = await ExamQuestionModel.findAll({
        where: { examId },
        order: [
          ["orderIndex", "ASC"],
          ["id", "ASC"],
        ],
      });

      const reviewQs = qs.map(pickReviewQuestion);

      const answers = new Map(
        JSON.parse(attempt.answersJson || "[]").map((x) => [
          String(x.qid),
          x.answer,
        ])
      );

      const review = reviewQs.map((q, idx) => {
        const user = answers.get(q.id) || null;
        const qq = qs[idx];

        let isCorrect = false;
        if (user != null) {
          const userStr = String(user);
          if (q.answer != null && userStr === String(q.answer)) {
            isCorrect = true;
          } else {
            const raw = JSON.parse(qq.choicesJson || "[]");
            const choices = toChoiceObjects(raw);
            const correctId = answerIdFrom(choices, qq.answer);
            if (userStr === String(correctId)) isCorrect = true;
            else if (choices.find((c) => c.id === userStr)?.text === qq.answer) isCorrect = true;
          }
        }

        return {
          question: q,
          userAnswer: user,
          isCorrect,
        };
      });

      res.json({
        success: true,
        data: {
          score: attempt.score ?? 0,
          review,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  // ============ 7) إضافة امتحان (أدمن) ============

  /**
   * @swagger
   * /exams:
   *   post:
   *     summary: إنشاء امتحان جديد (أدمن فقط)
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateExamRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء الامتحان
   *       400:
   *         description: العنوان مفقود أو بيانات غير صالحة
   *       403:
   *         description: هذا الإجراء للأدمن فقط
   *       401:
   *         description: غير مصرح
   */
  router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      if (String(req.user?.role || "").toLowerCase() !== "admin") {
        return res.status(403).json({
          success: false,
          message: "صلاحية مرفوضة: هذا الإجراء للأدمن فقط",
        });
      }

      const {
        title,
        description,
        category,
        grade,
        level,
        durationMin,
        isFree,
        status,
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "العنوان مطلوب",
        });
      }

      const gradeNorm = normalizeLevel(grade) || null;

      const exam = await ExamModel.create({
        title,
        description: description || "",
        category: category || null,
        grade: gradeNorm,
        level: level || null,
        durationMin: durationMin || 0,
        isFree: !!isFree,
        status: status || "draft",
        isDeleted: false,
        createdAt: new Date(),
        updatedAtLocal: new Date(),
      });

      res.json({ success: true, data: exam });
    } catch (e) {
      next(e);
    }
  });

  // ============ 8) إضافة أسئلة بالجملة (أدمن) ============

  /**
   * @swagger
   * /exams/{id}/questions/bulk:
   *   post:
   *     summary: إضافة أسئلة بالجملة لامتحان (أدمن)
   *     tags: [Exams]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الامتحان
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkQuestionsRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء الأسئلة بنجاح
   *       400:
   *         description: خطأ في أحد الأسئلة أو مصفوفة فارغة
   *       403:
   *         description: هذا الإجراء للأدمن فقط
   *       404:
   *         description: الامتحان غير موجود
   *       401:
   *         description: غير مصرح
   */
  router.post("/:id/questions/bulk", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      if (String(req.user?.role || "").toLowerCase() !== "admin") {
        return res.status(403).json({
          success: false,
          message: "صلاحية مرفوضة: هذا الإجراء للأدمن فقط",
        });
      }

      const examId = Number(req.params.id);
      const exam = await ExamModel.findByPk(examId);
      if (!exam || exam.isDeleted) {
        return res
          .status(404)
          .json({ success: false, message: "الامتحان غير موجود" });
      }

      const questions = Array.isArray(req.body?.questions)
        ? req.body.questions
        : [];
      if (!questions.length) {
        return res
          .status(400)
          .json({ success: false, message: "أرسل مصفوفة questions غير فارغة" });
      }

      for (const [i, q] of questions.entries()) {
        if (!q?.text || !Array.isArray(q?.choices) || q.choices.length < 2) {
          return res.status(400).json({
            success: false,
            message: `سؤال #${i + 1}: نص السؤال والاختيارات مطلوبان (>=2)`,
          });
        }
        if (typeof q.answer !== "string" || !q.choices.includes(q.answer)) {
          return res.status(400).json({
            success: false,
            message: `سؤال #${
              i + 1
            }: answer يجب أن يكون عنصرًا موجودًا داخل choices`,
          });
        }

        if (q.choiceExplanations != null) {
          if (typeof q.choiceExplanations !== "object" || Array.isArray(q.choiceExplanations)) {
            return res.status(400).json({
              success: false,
              message: `سؤال #${i + 1}: choiceExplanations يجب أن يكون Object (Map)`,
            });
          }
        }
      }

      const t = await ExamQuestionModel.sequelize.transaction();
      try {
        const maxRow = await ExamQuestionModel.findOne({
          where: { examId },
          order: [["orderIndex", "DESC"]],
          transaction: t,
        });
        let order = (maxRow?.orderIndex || 0) + 1;

        const rows = questions.map((qItem) => ({
          examId,
          text: qItem.text,
          imageUrl: qItem.imageUrl ?? null,
          choicesJson: JSON.stringify(qItem.choices),
          answer: qItem.answer,

          explanation: qItem.explanation ?? null,
          choiceExplanationsJson: qItem.choiceExplanations
            ? JSON.stringify(qItem.choiceExplanations)
            : null,

          orderIndex: qItem.orderIndex ?? order++,
          createdAt: new Date(),
          updatedAtLocal: new Date(),
        }));

        const created = await ExamQuestionModel.bulkCreate(rows, {
          transaction: t,
          returning: true,
        });
        await t.commit();

        res.json({
          success: true,
          data: created.map((qx) => ({
            id: String(qx.id),
            orderIndex: qx.orderIndex,
          })),
        });
      } catch (err) {
        await t.rollback();
        return next(err);
      }
    } catch (e) {
      next(e);
    }
  });

  return router;
}
