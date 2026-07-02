// src/routes/self-quiz.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import softAuth from '../middlewares/soft-auth.js';
import { requireRole } from '../middlewares/roles.js';
import { isAllowedHost } from '../utils/url-guard.js';
import { normalizeLevel } from '../utils/levels.js';
import { encodeId, decodeId } from '../utils/hash.js'; // ⚡ NEW

/**
 * @swagger
 * tags:
 *   name: SelfQuiz
 *   description: نظام أسئلة المذاكرة الذاتية (فصول، أسئلة MCQ، محاولات الطالب).
 *
 * components:
 *   schemas:
 *     SelfQuizChapter:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         gradeLevel:
 *           type: string
 *           description: المرحلة/السنة الدراسية (normalized level).
 *         title:
 *           type: string
 *         orderIndex:
 *           type: integer
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     SelfQuizQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         chapterId:
 *           type: integer
 *         body:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         explanation:
 *           type: string
 *           nullable: true
 *         orderIndex:
 *           type: integer
 *
 *     SelfQuizChoice:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         questionId:
 *           type: integer
 *         label:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         isCorrect:
 *           type: boolean
 *         orderIndex:
 *           type: integer
 *
 *     SelfQuizPlayQuestion:
 *       type: object
 *       description: سؤال في وضع اللعب (بدون isCorrect في الاختيارات).
 *       properties:
 *         id:
 *           type: integer
 *         body:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         explanation:
 *           type: string
 *           nullable: true
 *         orderIndex:
 *           type: integer
 *         choices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               questionId:
 *                 type: integer
 *               label:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 nullable: true
 *               orderIndex:
 *                 type: integer
 *
 *     SelfQuizPlayPayload:
 *       type: object
 *       properties:
 *         chapter:
 *           $ref: '#/components/schemas/SelfQuizChapter'
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SelfQuizPlayQuestion'
 *
 *     SelfQuizCompletion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *         chapterId:
 *           type: integer
 *         isPerfect:
 *           type: boolean
 *         totalQuestions:
 *           type: integer
 *         totalCorrect:
 *           type: integer
 *         lastAttemptAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

function validateMCQ(q) {
  const errors = [];
  if (!q.body || String(q.body).trim().length < 3) errors.push('body مطلوب (≥3)');
  if (q.imageUrl && !isAllowedHost(String(q.imageUrl))) errors.push('imageUrl غير مسموح');
  const choices = Array.isArray(q.choices) ? q.choices : [];
  if (choices.length < 2) errors.push('يلزم اختياران على الأقل');
  const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
  if (correctIndex < 0 || correctIndex >= choices.length) errors.push('correctIndex غير صالح');
  choices.forEach((c) => {
    if (!c || (!c.label && !c.imageUrl)) errors.push('اختيار غير صالح');
    if (c.imageUrl && !isAllowedHost(String(c.imageUrl))) errors.push('imageUrl للاختيار غير مسموح');
  });
  return errors;
}

export default function createSelfQuizRouter(models) {
  const router = Router();

  const modelsSafe = models || {};

  const {
    SelfQuizChapterMysql,
    SelfQuizChapter,
    SelfQuizQuestionMysql,
    SelfQuizQuestion,
    SelfQuizChoiceMysql,
    SelfQuizChoice,
    SelfQuizCompletionMysql,
    SelfQuizCompletion,
  } = modelsSafe;

  // موديلات موحّدة تدعم كل التسميات المحتملة
  const SelfQuizChapterModel =
    SelfQuizChapterMysql ||
    SelfQuizChapter ||
    modelsSafe.SelfQuizChapterMysql ||
    modelsSafe.SelfQuizChapter ||
    null;

  const SelfQuizQuestionModel =
    SelfQuizQuestionMysql ||
    SelfQuizQuestion ||
    modelsSafe.SelfQuizQuestionMysql ||
    modelsSafe.SelfQuizQuestion ||
    null;

  const SelfQuizChoiceModel =
    SelfQuizChoiceMysql ||
    SelfQuizChoice ||
    modelsSafe.SelfQuizChoiceMysql ||
    modelsSafe.SelfQuizChoice ||
    null;

  const SelfQuizCompletionModel =
    SelfQuizCompletionMysql ||
    SelfQuizCompletion ||
    modelsSafe.SelfQuizCompletionMysql ||
    modelsSafe.SelfQuizCompletion ||
    null;

  if (!SelfQuizChapterModel) {
    throw new Error(
      'SelfQuizChapter model (SelfQuizChapter / SelfQuizChapterMysql) is not configured'
    );
  }
  if (!SelfQuizQuestionModel) {
    throw new Error(
      'SelfQuizQuestion model (SelfQuizQuestion / SelfQuizQuestionMysql) is not configured'
    );
  }
  if (!SelfQuizChoiceModel) {
    throw new Error(
      'SelfQuizChoice model (SelfQuizChoice / SelfQuizChoiceMysql) is not configured'
    );
  }
  if (!SelfQuizCompletionModel) {
    throw new Error(
      'SelfQuizCompletion model (SelfQuizCompletion / SelfQuizCompletionMysql) is not configured'
    );
  }

  // ============ Admin/User ============

  /**
   * @swagger
   * /self-quiz/chapters:
   *   post:
   *     summary: إنشاء فصل Self-Quiz جديد
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - gradeLevel
   *               - title
   *             properties:
   *               gradeLevel:
   *                 type: string
   *                 description: المرحلة/السنة الدراسية (سيتم عمل normalize لها).
   *                 example: "3sec"
   *               title:
   *                 type: string
   *                 example: "الديناميكا - الفصل الأول"
   *               orderIndex:
   *                 type: integer
   *                 example: 1
   *     responses:
   *       200:
   *         description: تم إنشاء الفصل بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/SelfQuizChapter'
   *       400:
   *         description: gradeLevel أو title غير صالح.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للـ admin / user فقط.
   */
  router.post(
    '/chapters',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const raw = req.body?.gradeLevel;
        const gradeLevel = normalizeLevel(raw);
        if (!gradeLevel) {
          return res
            .status(400)
            .json({ success: false, message: 'gradeLevel غير صالح' });
        }

        const title = String(req.body?.title || '').trim();
        if (!title) {
          return res
            .status(400)
            .json({ success: false, message: 'title مطلوب' });
        }

        const orderIndex = Number(req.body?.orderIndex || 0);
        const now = new Date();

        const created = await SelfQuizChapterModel.create({
          gradeLevel,
          title,
          orderIndex,
          createdAtLocal: now,
          updatedAtLocal: now,
        });

        return res.json({ success: true, data: created });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/chapters/{chapterId}/questions/bulk:
   *   post:
   *     summary: إنشاء عدة أسئلة MCQ مع اختياراتها لفصل واحد في طلب واحد
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chapterId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الفصل المستهدف.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - questions
   *             properties:
   *               questions:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - body
   *                     - choices
   *                     - correctIndex
   *                   properties:
   *                     body:
   *                       type: string
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                     explanation:
   *                       type: string
   *                       nullable: true
   *                     orderIndex:
   *                       type: integer
   *                     choices:
   *                       type: array
   *                       minItems: 2
   *                       items:
   *                         type: object
   *                         properties:
   *                           label:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           orderIndex:
   *                             type: integer
   *                     correctIndex:
   *                       type: integer
   *                       description: index للاختيار الصحيح داخل المصفوفة.
   *     responses:
   *       200:
   *         description: تم إنشاء الأسئلة والاختيارات بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       question:
   *                         $ref: '#/components/schemas/SelfQuizQuestion'
   *                       choices:
   *                         type: array
   *                         items:
   *                           $ref: '#/components/schemas/SelfQuizChoice'
   *       400:
   *         description: validation error (questions[] أو MCQ غير صالح).
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للـ admin / user فقط.
   *       404:
   *         description: الفصل غير موجود.
   */
  router.post(
    '/chapters/:chapterId/questions/bulk',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const chapterId = Number(req.params.chapterId);
        const chapter = await SelfQuizChapterModel.findOne({
          where: { id: chapterId, isDeleted: false },
        });
        if (!chapter) {
          return res
            .status(404)
            .json({ success: false, message: 'الفصل غير موجود' });
        }

        const items = Array.isArray(req.body?.questions)
          ? req.body.questions
          : [];
        if (!items.length) {
          return res
            .status(400)
            .json({ success: false, message: 'questions[] مطلوب' });
        }

        const createdQuestions = [];

        for (const q of items) {
          const errs = validateMCQ(q);
          if (errs.length) {
            return res.status(400).json({ success: false, errors: errs });
          }

          const now = new Date();

          const question = await SelfQuizQuestionModel.create({
            chapterId,
            body: q.body.trim(),
            imageUrl: q.imageUrl ? String(q.imageUrl).trim() : null,
            explanation: q.explanation ?? null,
            orderIndex: Number.isInteger(q.orderIndex) ? q.orderIndex : 0,
            createdAtLocal: now,
            updatedAtLocal: now,
          });

          const createdChoices = [];
          for (const [idx, c] of q.choices.entries()) {
            const choice = await SelfQuizChoiceModel.create({
              questionId: question.id,
              label: c.label || '',
              imageUrl: c.imageUrl ?? null,
              isCorrect: idx === Number(q.correctIndex),
              orderIndex: Number.isInteger(c.orderIndex)
                ? c.orderIndex
                : idx + 1,
              createdAtLocal: now,
              updatedAtLocal: now,
            });

            createdChoices.push(choice);
          }

          createdQuestions.push({ question, choices: createdChoices });
        }

        return res.json({ success: true, data: createdQuestions });
      } catch (e) {
        next(e);
      }
    }
  );

  // ============ Student ============

  /**
   * @swagger
   * /self-quiz/chapters:
   *   get:
   *     summary: قائمة فصول الـ Self-Quiz (حسب الصف)
   *     description: يمكن استدعاؤها بدون توكن (softAuth) أو مع طالب مسجل؛ يتم تحديد gradeLevel من query أو من مستوى الطالب.
   *     tags: [SelfQuiz]
   *     parameters:
   *       - in: query
   *         name: gradeLevel
   *         schema:
   *           type: string
   *         description: فلترة حسب الصف/السنة؛ لو لم تُرسل يحاول النظام استخدام level من المستخدم.
   *     responses:
   *       200:
   *         description: قائمة فصول المذاكرة الذاتية.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SelfQuizChapter'
   */
  router.get('/chapters', softAuth, async (req, res, next) => {
    try {
      const levelQ = String(req.query.gradeLevel || '').trim();
      const where = { isDeleted: false };

      if (levelQ) {
        const lv = normalizeLevel(levelQ);
        if (lv) where.gradeLevel = lv;
      } else if (req.user?.level) {
        const lvUser = normalizeLevel(req.user.level) || req.user.level;
        if (lvUser) where.gradeLevel = lvUser;
      }

      const rows = await SelfQuizChapterModel.findAll({
        where,
        order: [
          ['orderIndex', 'ASC'],
          ['id', 'ASC'],
        ],
        attributes: [
          'id',
          'title',
          'gradeLevel',
          'orderIndex',
          'createdAtLocal',
          'updatedAtLocal',
        ],
      });
      const data = rows.map(r => ({ ...r.toJSON(), secureId: encodeId(r.id) }));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /self-quiz/chapters/{chapterId}/play:
   *   get:
   *     summary: وضع اللعب لفصل معين (أسئلة + اختيارات بدون كشف الإجابة الصحيحة)
   *     tags: [SelfQuiz]
   *     parameters:
   *       - in: path
   *         name: chapterId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الفصل.
   *     responses:
   *       200:
   *         description: بيانات الفصل + الأسئلة بصيغة مناسبة للـ Frontend.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/SelfQuizPlayPayload'
   *       404:
   *         description: الفصل غير موجود.
   */
  router.get('/chapters/:chapterId/play', softAuth, async (req, res, next) => {
    try {
      let chapterId = Number(req.params.chapterId);
      if (isNaN(chapterId)) {
        chapterId = decodeId(req.params.chapterId);
      }
      const chapter = await SelfQuizChapterModel.findOne({
        where: { id: chapterId, isDeleted: false },
      });
      if (!chapter) {
        return res
          .status(404)
          .json({ success: false, message: 'الفصل غير موجود' });
      }

      const questions = await SelfQuizQuestionModel.findAll({
        where: { chapterId, isDeleted: false },
        order: [
          ['orderIndex', 'ASC'],
          ['id', 'ASC'],
        ],
        attributes: ['id', 'body', 'imageUrl', 'explanation', 'orderIndex'],
      });

      const qIds = questions.map((q) => q.id);
      const choices = qIds.length
        ? await SelfQuizChoiceModel.findAll({
            where: { questionId: { [Op.in]: qIds } },
            order: [
              ['orderIndex', 'ASC'],
              ['id', 'ASC'],
            ],
            attributes: ['id', 'questionId', 'label', 'imageUrl', 'orderIndex'],
          })
        : [];

      const byQ = new Map(qIds.map((id) => [id, []]));
      for (const c of choices) byQ.get(c.questionId).push(c);

      const payload = questions.map((q) => ({
        ...q.toJSON(),
        choices: byQ.get(q.id) || [],
      }));

      res.json({ success: true, data: { chapter, questions: payload } });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /self-quiz/attempts/check:
   *   post:
   *     summary: التحقق من إجابة سؤال واحد
   *     description: يستقبل questionId و choiceId ويرجع هل الإجابة صحيحة مع الشرح إن وجد.
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - questionId
   *               - choiceId
   *             properties:
   *               questionId:
   *                 type: integer
   *               choiceId:
   *                 type: integer
   *     responses:
   *       200:
   *         description: نتيجة التحقق من الإجابة.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     correct:
   *                       type: boolean
   *                     explanation:
   *                       type: string
   *                       nullable: true
   *       400:
   *         description: questionId أو choiceId غير صالح.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للطلاب فقط.
   *       404:
   *         description: السؤال غير موجود.
   */
  router.post(
    '/attempts/check',
    requireAuth,
    requireRole('student'),
    async (req, res, next) => {
      try {
        const questionId = Number(req.body?.questionId);
        const choiceId = Number(req.body?.choiceId);
        if (!questionId || !choiceId) {
          return res.status(400).json({
            success: false,
            message: 'questionId و choiceId مطلوبان',
          });
        }

        const question = await SelfQuizQuestionModel.findOne({
          where: { id: questionId, isDeleted: false },
        });
        if (!question) {
          return res
            .status(404)
            .json({ success: false, message: 'السؤال غير موجود' });
        }

        const choice = await SelfQuizChoiceModel.findOne({
          where: { id: choiceId, questionId },
        });
        if (!choice) {
          return res.status(400).json({
            success: false,
            message: 'اختيار غير تابع للسؤال',
          });
        }

        res.json({
          success: true,
          data: {
            correct: !!choice.isCorrect,
            explanation: question.explanation ?? null,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/chapters/{chapterId}/complete:
   *   post:
   *     summary: وسم فصل كمكتمل لطالب معيّن
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chapterId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الفصل الذي تم حله.
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               totalQuestions:
   *                 type: integer
   *               totalCorrect:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم تسجيل حالة الفصل للطالب.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     chapterId:
   *                       type: integer
   *                     isPerfect:
   *                       type: boolean
   *                     totalQuestions:
   *                       type: integer
   *                     totalCorrect:
   *                       type: integer
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للطلاب فقط.
   *       404:
   *         description: الفصل غير موجود.
   */
  router.post(
    '/chapters/:chapterId/complete',
    requireAuth,
    requireRole('student'),
    async (req, res, next) => {
      try {
        let chapterId = Number(req.params.chapterId);
        if (isNaN(chapterId)) {
          chapterId = decodeId(req.params.chapterId);
        }
        const { totalQuestions = 0, totalCorrect = 0 } = req.body || {};
        const studentId = Number(req.user.id);

        const chapter = await SelfQuizChapterModel.findOne({
          where: { id: chapterId, isDeleted: false },
        });
        if (!chapter) {
          return res
            .status(404)
            .json({ success: false, message: 'الفصل غير موجود' });
        }

        const isPerfect =
          Number(totalQuestions) > 0 &&
          Number(totalCorrect) === Number(totalQuestions);

        const [row, created] = await SelfQuizCompletionModel.findOrCreate({
          where: { studentId, chapterId },
          defaults: {
            studentId,
            chapterId,
            isPerfect,
            totalQuestions,
            totalCorrect,
            lastAttemptAt: new Date(),
            updatedAtLocal: new Date(),
          },
        });

        if (!created) {
          row.isPerfect = isPerfect;
          row.totalQuestions = Number(totalQuestions);
          row.totalCorrect = Number(totalCorrect);
          row.lastAttemptAt = new Date();
          row.updatedAtLocal = new Date();
          await row.save();
        }

        res.json({
          success: true,
          data: { chapterId, isPerfect, totalQuestions, totalCorrect },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/completions/my:
   *   get:
   *     summary: حالة فصول الـ Self-Quiz الخاصة بالطالب الحالي
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة بما أكمله الطالب في فصول المذاكرة الذاتية.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SelfQuizCompletion'
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للطلاب فقط.
   */
  router.get(
    '/completions/my',
    requireAuth,
    requireRole('student'),
    async (req, res, next) => {
      try {
        const rows = await SelfQuizCompletionModel.findAll({
          where: { studentId: Number(req.user.id) },
          order: [['chapterId', 'ASC']],
        });
        res.json({ success: true, data: rows });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/questions/{id}:
   *   patch:
   *     summary: تعديل بيانات سؤال واحد (بدون اختيارات)
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               body:
   *                 type: string
   *               imageUrl:
   *                 type: string
   *                 nullable: true
   *               explanation:
   *                 type: string
   *                 nullable: true
   *               orderIndex:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم تعديل السؤال.
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للـ admin / user فقط.
   *       404:
   *         description: السؤال غير موجود.
   */
  router.patch(
    '/questions/:id',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const q = await SelfQuizQuestionModel.findByPk(id);
        if (!q || q.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'السؤال غير موجود' });
        }

        const patch = { updatedAtLocal: new Date() };
        ['body', 'imageUrl', 'explanation', 'orderIndex'].forEach((k) => {
          if (req.body[k] !== undefined) patch[k] = req.body[k];
        });
        await q.update(patch);
        res.json({ success: true, data: { id, ...patch } });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/questions/{id}:
   *   delete:
   *     summary: حذف سؤال (soft delete)
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال.
   *     responses:
   *       200:
   *         description: تم حذف السؤال (isDeleted=true).
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للـ admin / user فقط.
   *       404:
   *         description: السؤال غير موجود.
   */
  router.delete(
    '/questions/:id',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const q = await SelfQuizQuestionModel.findByPk(id);
        if (!q || q.isDeleted) {
          return res
            .status(404)
            .json({ success: false, message: 'السؤال غير موجود' });
        }
        await q.update({ isDeleted: true, updatedAtLocal: new Date() });
        res.json({ success: true, message: 'تم حذف السؤال' });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /self-quiz/chapters/{chapterId}/questions:
   *   get:
   *     summary: (لوحة الإدارة) جلب أسئلة الفصل مع الاختيارات بما فيها isCorrect
   *     tags: [SelfQuiz]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chapterId
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم الفصل.
   *     responses:
   *       200:
   *         description: قائمة الأسئلة مع الاختيارات كاملة.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                       body:
   *                         type: string
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                       explanation:
   *                         type: string
   *                         nullable: true
   *                       orderIndex:
   *                         type: integer
   *                       choices:
   *                         type: array
   *                         items:
   *                           $ref: '#/components/schemas/SelfQuizChoice'
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: متاح للـ admin / user فقط.
   *       404:
   *         description: الفصل غير موجود.
   */
  router.get(
    '/chapters/:chapterId/questions',
    requireAuth,
    requireRole('admin', 'user'),
    async (req, res, next) => {
      try {
        const chapterId = Number(req.params.chapterId);
        const chapter = await SelfQuizChapterModel.findOne({
          where: { id: chapterId, isDeleted: false },
        });

        if (!chapter) {
          return res
            .status(404)
            .json({ success: false, message: 'الفصل غير موجود' });
        }

        const questions = await SelfQuizQuestionModel.findAll({
          where: { chapterId, isDeleted: false },
          order: [
            ['orderIndex', 'ASC'],
            ['id', 'ASC'],
          ],
          attributes: ['id', 'body', 'imageUrl', 'explanation', 'orderIndex'],
        });

        const qIds = questions.map((q) => q.id);

        let choices = [];
        if (qIds.length) {
          choices = await SelfQuizChoiceModel.findAll({
            where: { questionId: { [Op.in]: qIds } },
            order: [
              ['orderIndex', 'ASC'],
              ['id', 'ASC'],
            ],
            attributes: [
              'id',
              'questionId',
              'label',
              'imageUrl',
              'isCorrect',
              'orderIndex',
            ],
          });
        }

        const byQ = new Map(qIds.map((id) => [id, []]));
        for (const c of choices) {
          byQ.get(c.questionId).push(c);
        }

        const payload = questions.map((q) => ({
          ...q.toJSON(),
          choices: byQ.get(q.id) || [],
        }));

        return res.json({ success: true, data: payload });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
