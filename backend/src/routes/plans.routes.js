// src/routes/plans.routes.js
import { Router } from 'express';
import { normalizeLevel } from '../utils/levels.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

const ALLOWED_SCOPE_TYPES = ['ALL', 'CATEGORY', 'GRADE', 'COURSE_LIST', 'LESSON_LIST'];
const MIN_PRICE = 0; 

// ... (Swagger Documentation removed for brevity, keep yours if needed) ...

// ===== Helpers =====
function normalizeGrade(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lv = normalizeLevel(s);
  return lv || null;
}

function normalizeCategories(input) {
  if (input == null) return null;
  const arr = Array.isArray(input) ? input : [input];
  const cleaned = arr.map((c) => String(c).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function normalizeCourseIds(input) {
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const ids = input
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length ? ids : null;
}

function parseCategoriesFromScopeValue(scopeValue) {
  if (!scopeValue) return null;
  try {
    const parsed = JSON.parse(scopeValue);
    if (Array.isArray(parsed)) {
      return parsed.map((c) => String(c).trim()).filter(Boolean);
    }
  } catch { }
  const s = String(scopeValue).trim();
  return s ? [s] : null;
}

function parseCourseIdsFromInclude(includeCourseIds) {
  if (!includeCourseIds) return null;
  try {
    const parsed = JSON.parse(includeCourseIds);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

function validatePlanBody(b, isPatch = false) {
  const errors = [];
  if (!isPatch) {
    if (!b.name || String(b.name).trim().length < 2) errors.push('name مطلوب (≥2)');
  } else if (b.name !== undefined && String(b.name).trim().length < 2) {
    errors.push('name غير صالح (≥2)');
  }
  if (b.priceCents !== undefined) {
    const p = Number(b.priceCents);
    if (!Number.isFinite(p) || p < MIN_PRICE) errors.push('priceCents غير صالح');
  }
  if (b.periodDays !== undefined) {
    const pd = Number(b.periodDays);
    if (!Number.isFinite(pd) || pd <= 0) errors.push('periodDays يجب أن يكون رقمًا موجبًا');
  }
  if (b.currency !== undefined && String(b.currency).length !== 3) errors.push('currency رمز عملة من 3 أحرف');
  
  if (b.grade !== undefined && b.grade !== null && String(b.grade).trim() !== '') {
    const g = normalizeGrade(b.grade);
    if (!g) errors.push('grade غير صالح');
  }
  
  if (b.scopeType !== undefined) {
    const S = String(b.scopeType || '').toUpperCase();
    if (!ALLOWED_SCOPE_TYPES.includes(S)) errors.push('scopeType غير صالح');
  }

  return errors;
}

// دالة مساعدة لحساب الحالة في الباك إند
function getSubscriptionStatus(start, end) {
  if (!start || !end) return 'pending';
  const now = new Date();
  const s = new Date(start);
  const e = new Date(end);
  if (s > now) return 'pending';
  if (e < now) return 'expired';
  return 'active';
}

function deriveUnit(periodDays) {
  if (!periodDays) return 'اشتراك';
  if (periodDays === 30) return 'اشتراك شهري';
  return `اشتراك ${periodDays} يوم`;
}

function buildScopeLabel(plan) {
  if (!plan) return '';
  if (plan.scopeType === 'ALL') return plan.scopeStage ? `كل المواد للمرحلة: ${plan.scopeStage}` : 'كل المواد';
  if (plan.scopeType === 'GRADE') return `خطة للمرحلة: ${plan.scopeStage}`;
  if (plan.scopeType === 'CATEGORY') return `خطة لفئة: ${plan.scopeValue}`;
  if (plan.scopeType === 'COURSE_LIST') return 'خطة لمواد محددة';
  if (plan.scopeType === 'LESSON_LIST') return 'خطة لمحاضرات محددة';
  return '';
}

function mapSubscriptionToUi(sub) {
  const plan = sub.Plan || sub.plan || {};
  
  // === المنطق السحري هنا للطالب أيضاً ===
  let start = sub.startDate;
  let end = sub.endDate;

  if (!start && sub.createdAt) start = sub.createdAt;
  if (!end && start && plan.periodDays) {
     const d = new Date(start);
     d.setDate(d.getDate() + plan.periodDays);
     end = d;
  }
  // ===================================

  return {
    id: sub.id,
    title: plan.name || 'خطة بدون اسم',
    desc: plan.description || '',
    price: typeof plan.priceCents === 'number' ? plan.priceCents / 100 : 0,
    unit: deriveUnit(plan.periodDays),
    status: getSubscriptionStatus(start, end),
    startDate: start ? new Date(start).toISOString() : null,
    endDate: end ? new Date(end).toISOString() : null,
    scope: buildScopeLabel(plan),
  };
}

export function createPlansRouter(models) {
  const router = Router();

  const PlanMysql = models.PlanMysql || models.Plan || models.PlanModel;
  const SubscriptionMysql = models.SubscriptionMysql || models.Subscription || models.SubscriptionModel;
  const StudentModel = models.StudentMysql || models.Student || models.StudentModel;

  if (PlanMysql && SubscriptionMysql && StudentModel) {
    if (!SubscriptionMysql.associations['Plan']) {
        SubscriptionMysql.belongsTo(PlanMysql, { foreignKey: 'planId', as: 'Plan' });
    }
    if (!SubscriptionMysql.associations['Student']) {
        SubscriptionMysql.belongsTo(StudentModel, { foreignKey: 'studentId', as: 'Student' });
    }
  }

  // --- Routes للطلاب ---
  router.get('/my-subscriptions', requireAuth, async (req, res, next) => {
    try {
      if (!SubscriptionMysql) return res.status(500).json({ success: false, error: 'Model error' });
      const user = req.user || {};
      const studentId = Number(user.id);
      if (!studentId || user.role !== 'student') return res.status(403).json({ success: false, message: 'Forbidden' });

      const subs = await SubscriptionMysql.findAll({
        where: { studentId },
        include: [{ model: PlanMysql, as: 'Plan' }],
        order: [['id', 'DESC']],
      });

      const data = subs.map((s) => mapSubscriptionToUi(s));
      res.json({ success: true, data });
    } catch (e) { next(e); }
  });

  router.get('/', async (_req, res, next) => {
    try {
      if (!PlanMysql) return res.status(500).json({ success: false });
      const rows = await PlanMysql.findAll({ order: [['id', 'DESC']] });
      res.json({ success: true, data: rows.map((r) => r.toJSON()) });
    } catch (e) { next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!PlanMysql) return res.status(500).json({ success: false });
      const row = await PlanMysql.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, data: row.toJSON() });
    } catch (e) { next(e); }
  });

  // --- Routes للأدمن ---

  router.post('/', requireAuth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      if (!PlanMysql) return res.status(500).json({ success: false });
      const b = req.body || {};
      const errors = validatePlanBody(b, false);
      if (errors.length) return res.status(400).json({ success: false, errors });

      // ... (نفس منطق إنشاء الخطة القديم - مختصر هنا) ...
      // بناء المتغيرات
      let rawGrade = b.grade;
      if (!rawGrade && b.scopeType === 'GRADE') rawGrade = b.scopeValue;
      const gradeNorm = normalizeGrade(rawGrade);
      
      let categories = b.categories ? normalizeCategories(b.categories) : (b.scopeType === 'CATEGORY' ? parseCategoriesFromScopeValue(b.scopeValue) : null);
      let courseIds = Array.isArray(b.courseIds) ? normalizeCourseIds(b.courseIds) : null;
      let lessonIds = Array.isArray(b.lessonIds) ? normalizeCourseIds(b.lessonIds) : null;

      let scopeType = b.scopeType || 'ALL', scopeValue = null, includeCourseIds = null, includeLessonIds = null;
      
      if (scopeType === 'COURSE_LIST' && courseIds && courseIds.length) { includeCourseIds = JSON.stringify(courseIds); }
      else if (scopeType === 'LESSON_LIST' && lessonIds && lessonIds.length) { includeLessonIds = JSON.stringify(lessonIds); }
      else if (scopeType === 'CATEGORY' && categories && categories.length) { scopeValue = JSON.stringify(categories); }
      else if (scopeType === 'GRADE') { scopeValue = gradeNorm; }

      const data = {
        name: String(b.name).trim(),
        description: b.description ?? null,
        priceCents: Number(b.priceCents ?? 0),
        currency: String(b.currency ?? 'EGP').toUpperCase(),
        periodDays: Number(b.periodDays ?? 30),
        scopeType, scopeValue, scopeStage: gradeNorm, includeCourseIds, includeLessonIds,
        isActive: b.isActive ?? true,
        updatedAtLocal: new Date(),
      };

      const created = await PlanMysql.create(data);
      res.json({ success: true, data: created.toJSON() });
    } catch (e) { next(e); }
  });

  router.patch('/:id', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
       const id = Number(req.params.id);
       const existing = await PlanMysql.findByPk(id);
       if(!existing) return res.status(404).json({success:false});

       const b = req.body || {};
       
       const patch = {};
       if (b.name !== undefined) patch.name = String(b.name).trim();
       if (b.description !== undefined) patch.description = b.description;
       if (b.priceCents !== undefined) patch.priceCents = Number(b.priceCents);
       if (b.currency !== undefined) patch.currency = String(b.currency).toUpperCase();
       if (b.periodDays !== undefined) patch.periodDays = Number(b.periodDays);
       if (b.isActive !== undefined) patch.isActive = b.isActive;
       
       let rawGrade = b.grade !== undefined ? b.grade : existing.scopeStage;
       if (b.scopeType === 'GRADE' && !b.grade) rawGrade = b.scopeValue;
       const gradeNorm = normalizeGrade(rawGrade);
       
       let scopeType = b.scopeType || existing.scopeType;
       let scopeValue = b.scopeValue !== undefined ? b.scopeValue : existing.scopeValue;
       let includeCourseIds = existing.includeCourseIds;
       let includeLessonIds = existing.includeLessonIds;
       
       if (b.scopeType) {
           includeCourseIds = null;
           includeLessonIds = null;
           scopeValue = null;
       }

       let courseIds = Array.isArray(b.courseIds) ? normalizeCourseIds(b.courseIds) : null;
       let lessonIds = Array.isArray(b.lessonIds) ? normalizeCourseIds(b.lessonIds) : null;

       if (scopeType === 'COURSE_LIST' && courseIds) {
           includeCourseIds = JSON.stringify(courseIds);
       } else if (scopeType === 'LESSON_LIST' && lessonIds) {
           includeLessonIds = JSON.stringify(lessonIds);
       } else if (scopeType === 'GRADE') {
           scopeValue = gradeNorm;
       } else if (scopeType === 'CATEGORY' && b.categories) {
           const cats = normalizeCategories(b.categories);
           scopeValue = cats ? JSON.stringify(cats) : null;
       } else if (scopeType === 'CATEGORY' && b.scopeValue) {
           scopeValue = b.scopeValue;
       }

       patch.scopeType = scopeType;
       patch.scopeValue = scopeValue;
       patch.scopeStage = gradeNorm;
       patch.includeCourseIds = includeCourseIds;
       patch.includeLessonIds = includeLessonIds;
       patch.updatedAtLocal = new Date();

       await existing.update(patch);
       res.json({ success: true, data: existing.toJSON() });
    } catch (e) { next(e); }
  });

  router.delete('/:id', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const rows = await PlanMysql.destroy({ where: { id } });
      if (!rows) return res.status(404).json({ success: false });
      res.json({ success: true, data: { id } });
    } catch (e) { next(e); }
  });

  // ==========================================================
  // 🔥🔥  الراوت اللي فيه التعديل (GET /admin/subscriptions) 🔥🔥
  // ==========================================================
  router.get('/admin/subscriptions', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      const subs = await SubscriptionMysql.findAll({
        include: [
          { model: PlanMysql, as: 'Plan' },
          { model: StudentModel, as: 'Student', attributes: ['id', 'studentName'] }
        ],
        order: [['id', 'DESC']],
      });

      const data = subs.map(s => {
        // 1. قراءة التواريخ الموجودة
        let start = s.startDate;
        let end = s.endDate;

        // 2. إذا لم يوجد تاريخ بدء، استخدم تاريخ الإنشاء
        if (!start && s.createdAt) {
           start = s.createdAt;
        }

        // 3. إذا لم يوجد تاريخ نهاية، احسبه بناءً على مدة الخطة
        if (!end && start && s.Plan && s.Plan.periodDays) {
           const d = new Date(start);
           d.setDate(d.getDate() + s.Plan.periodDays);
           end = d;
        }

        return {
          id: s.id,
          studentId: s.studentId,
          studentName: s.Student ? s.Student.studentName : 'طالب غير موجود',
          planId: s.planId,
          planName: s.Plan ? s.Plan.name : 'خطة محذوفة',
          priceCents: s.Plan ? s.Plan.priceCents : 0,
          currency: s.Plan ? s.Plan.currency : 'EGP',
          // نرجع التواريخ المحسوبة
          startAt: start, 
          endAt: end,
          // نحسب الحالة بناءً على التواريخ المحسوبة
          status: getSubscriptionStatus(start, end),
          autoRenew: false
        };
      });

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  router.post('/admin/subscriptions', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      const { studentId, planId, startAt, endAt } = req.body;
      if (!studentId || !planId) return res.status(400).json({ success: false });

      const plan = await PlanMysql.findByPk(planId);
      if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

      // استخدام التواريخ المرسلة أو الحالية
      let startDate = startAt ? new Date(startAt) : new Date();
      let endDate = endAt ? new Date(endAt) : null;

      // حساب النهاية لو مش مبعوتة
      if (!endDate && plan.periodDays) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.periodDays);
      }

      const newSub = await SubscriptionMysql.create({
        studentId,
        planId,
        startDate,
        endDate
      });

      res.json({ success: true, data: newSub });
    } catch (e) { next(e); }
  });

  router.patch('/admin/subscriptions/:id', requireAuth, requireRole('admin', 'supervisor', 'user'), async (req, res, next) => {
    try {
      const { startAt, endAt, planId } = req.body;
      const sub = await SubscriptionMysql.findByPk(req.params.id);
      if (!sub) return res.status(404).json({ success: false });

      if (startAt) sub.startDate = new Date(startAt);
      if (endAt) sub.endDate = new Date(endAt);
      if (planId) sub.planId = planId;

      await sub.save();
      res.json({ success: true, data: sub });
    } catch (e) { next(e); }
  });

  router.delete('/admin/subscriptions/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const rows = await SubscriptionMysql.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ success: false });
      res.json({ success: true, data: { id: Number(req.params.id) } });
    } catch (e) { next(e); }
  });

  return router;
}

export default createPlansRouter;