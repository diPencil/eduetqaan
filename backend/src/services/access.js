// src/services/access.js
import { normalizeLevel } from '../utils/levels.js';

/**
 * Resolve model by preferring the *Mysql name* then fallback to a base name.
 * Examples it will try: CourseMysql -> Course
 */
function resolveMysqlModel(models, baseName) {
  if (!models || !baseName) return null;
  const candidates = [`${baseName}Mysql`, baseName, `${baseName}Model`];
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(models, c) && models[c]) return models[c];
  }
  // fallback: case-insensitive contains match
  const keys = Object.keys(models || {});
  const target = baseName.toLowerCase();
  for (const k of keys) {
    if (k.toLowerCase().includes(target)) return models[k];
  }
  return null;
}

/** هل now داخل [start,end] ؟ */
function isInRange(start, end, nowMs) {
  const s = start ? new Date(start).getTime() : null;
  const e = end ? new Date(end).getTime() : null;
  const t = nowMs ?? Date.now();
  if (s != null && t < s) return false;
  if (e != null && t > e) return false;
  return true;
}

function categoryMatches(scopeValue, category) {
  if (!scopeValue || !category) return false;
  const cat = String(category).trim();
  if (!cat) return false;

  try {
    const parsed = JSON.parse(scopeValue);
    if (Array.isArray(parsed)) {
      return parsed.some((c) => String(c).trim() === cat);
    }
  } catch {
    // not JSON -> treat as single value
  }

  return String(scopeValue).trim() === cat;
}

function courseListMatches(includeCourseIds, courseId) {
  if (!includeCourseIds || !courseId) return false;
  try {
    const parsed = JSON.parse(includeCourseIds);
    if (!Array.isArray(parsed)) return false;
    const cid = Number(courseId);
    return parsed.some((id) => Number(id) === cid);
  } catch {
    return false;
  }
}

/**
 * hasEntitlement expects models object that contains MySQL models.
 * It no longer references any "Sqlite" models.
 */
export async function hasEntitlement({ models, studentId, resource }) {
  const Subscription = resolveMysqlModel(models, 'Subscription');
  const Plan = resolveMysqlModel(models, 'Plan');
  const Enrollment = resolveMysqlModel(models, 'Enrollment');
  const Course = resolveMysqlModel(models, 'Course');
  const Student = resolveMysqlModel(models, 'Student');
  const SubscriptionConsumption = resolveMysqlModel(models, 'SubscriptionConsumption');
  const Lesson = resolveMysqlModel(models, 'Lesson');

  if (!studentId) return { ok: false, via: null, reason: 'NO_STUDENT' };
  if (!resource || !resource.type) return { ok: false, via: null, reason: 'NO_RESOURCE' };

  // 🛡️ FETCH STUDENT & GRADE ONCE
  const student = Student ? await Student.findByPk(studentId) : null;
  const studentGrade = student ? normalizeLevel(student.year) : null;
  const isAdmin = student?.role === 'admin' || student?.role === 'user';

  const type = String(resource.type).toUpperCase();
  const nowMs = Date.now();

  // ------------------------------
  // COURSE
  // ------------------------------
  if (type === 'COURSE') {
    const courseId = Number(resource.id);
    if (!courseId) return { ok: false, via: null, reason: 'COURSE_ID_INVALID' };

    if (!Course || typeof Course.findByPk !== 'function') {
      return { ok: false, via: null, reason: 'COURSE_MODEL_MISSING' };
    }

    const course = await Course.findByPk(courseId);
    if (!course || course.isDeleted) return { ok: false, via: null, reason: 'COURSE_NOT_FOUND' };

    // 🛡️ MANDATORY GRADE CHECK (Course)
    const courseGrade = normalizeLevel(course.level);
    
    // If student has a grade, it MUST match the course grade.
    // We only allow if grades match exactly after normalization.
    if (!isAdmin && studentGrade && courseGrade && studentGrade !== courseGrade) {
      return { ok: false, via: null, reason: 'GRADE_MISMATCH' };
    }
    
    // Safety: If student is a student (not admin) and has no grade set, 
    // but the course DOES have a specific grade, we should probably block it too.
    if (!isAdmin && !studentGrade && courseGrade) {
       return { ok: false, via: null, reason: 'GRADE_MISMATCH' };
    }

    if (course.isFree) return { ok: true, via: 'free', scope: 'free', courseId };

    // Enrollment check (purchase)
    if (Enrollment && typeof Enrollment.findOne === 'function') {
      const enr = await Enrollment.findOne({ where: { studentId, courseId } });
      if (enr && isInRange(enr.startsAt, enr.endsAt, nowMs)) {
        return {
          ok: true,
          via: 'enrollment',
          scope: 'course',
          courseId,
          enrollmentId: enr.id,
        };
      }
    }

    // Subscriptions check
    if (!Subscription || typeof Subscription.findAll !== 'function') {
      return { ok: false, via: null, reason: 'NO_SUBSCRIPTION_MODEL' };
    }

    const subs = await Subscription.findAll({
      where: { studentId, status: 'active' },
      order: [['id', 'DESC']],
      limit: 30,
    });

    const courseCategory = (course.category || '').trim() || null;

    for (const sub of subs) {
      if (!isInRange(sub.startsAt, sub.endsAt, nowMs)) continue;

      // get plan
      let plan = null;
      if (Plan && typeof Plan.findByPk === 'function') {
        plan = await Plan.findByPk(sub.planId);
      }
      if (!plan || !plan.isActive) continue;

      const scopeType = String(plan.scopeType || '').toUpperCase();

      // normalize plan grade
      let planGrade = null;
      if (plan.scopeStage) {
        planGrade = normalizeLevel(plan.scopeStage) || String(plan.scopeStage).trim() || null;
      }
      if (!planGrade && scopeType === 'GRADE' && plan.scopeValue) {
        planGrade = normalizeLevel(plan.scopeValue) || String(plan.scopeValue).trim() || null;
      }
      if (planGrade && studentGrade && planGrade !== studentGrade) continue;

      // does plan cover the course?
      let covers = false;
      let scope = null;

      if (scopeType === 'ALL' || scopeType === 'GRADE' || scopeType === 'STAGE') {
        covers = true;
        scope = 'all';
      } else if (scopeType === 'CATEGORY' || scopeType === 'SUBJECT') {
        if (courseCategory && categoryMatches(plan.scopeValue, courseCategory)) {
          covers = true;
          scope = 'category';
        }
      } else if (scopeType === 'COURSE_LIST') {
        if (courseListMatches(plan.includeCourseIds, courseId)) {
          covers = true;
          scope = 'course_list';
        }
      }

      if (!covers) continue;

      const planKind = String(plan.kind || 'UNLIMITED').toUpperCase();

      if (planKind === 'UNLIMITED') {
        return {
          ok: true,
          via: 'subscription',
          scope,
          planKind: 'UNLIMITED',
          planId: plan.id,
          subscriptionId: sub.id,
          courseId,
        };
      }

      if (planKind === 'QUOTA') {
        if (!SubscriptionConsumption || typeof SubscriptionConsumption.findOne !== 'function') {
          return {
            ok: false,
            via: 'subscription_quota_eligible',
            scope,
            planKind: 'QUOTA',
            consumed: false,
            planId: plan.id,
            subscriptionId: sub.id,
            courseId,
            nextAction: 'claim-required',
            reason: 'CONSUMPTION_MODEL_MISSING',
          };
        }

        const consumed = await SubscriptionConsumption.findOne({
          where: { subscriptionId: sub.id, courseId },
        });

        if (consumed) {
          return {
            ok: true,
            via: 'subscription',
            scope,
            planKind: 'QUOTA',
            consumed: true,
            planId: plan.id,
            subscriptionId: sub.id,
            courseId,
          };
        }

        return {
          ok: false,
          via: 'subscription_quota_eligible',
          scope,
          planKind: 'QUOTA',
          consumed: false,
          planId: plan.id,
          subscriptionId: sub.id,
          courseId,
          nextAction: 'claim-required',
          reason: 'COURSE_NOT_CONSUMED_YET',
        };
      }

      // fallback
      return {
        ok: true,
        via: 'subscription',
        scope,
        planKind,
        planId: plan.id,
        subscriptionId: sub.id,
        courseId,
      };
    }

    return { ok: false, via: null, reason: 'NO_ACCESS' };
  }

  // ------------------------------
  // EXAM
  // ------------------------------
  if (type === 'EXAM') {
    const resourceGrade = normalizeLevel(resource.level) || resource.level || null;
    const examCategory = resource.category || null;

    // 🛡️ MANDATORY GRADE CHECK (Exam)
    if (!isAdmin) {
      if (studentGrade && resourceGrade && studentGrade !== resourceGrade) {
        return { ok: false, via: null, reason: 'GRADE_MISMATCH' };
      }
      if (!studentGrade && resourceGrade) {
        return { ok: false, via: null, reason: 'GRADE_MISMATCH' };
      }
    }

    if (resource.isFree) return { ok: true, via: 'free', scope: 'free' };

    if (!Subscription || typeof Subscription.findAll !== 'function') {
      return { ok: false, via: null, reason: 'NO_SUBSCRIPTION_MODEL' };
    }

    const subs = await Subscription.findAll({
      where: { studentId, status: 'active' },
      order: [['id', 'DESC']],
      limit: 30,
    });

    for (const sub of subs) {
      if (!isInRange(sub.startsAt, sub.endsAt, nowMs)) continue;

      let plan = null;
      if (Plan && typeof Plan.findByPk === 'function') {
        plan = await Plan.findByPk(sub.planId);
      }
      if (!plan || !plan.isActive) continue;

      const scopeType = String(plan.scopeType || '').toUpperCase();

      let planGrade = null;
      if (plan.scopeStage) {
        planGrade = normalizeLevel(plan.scopeStage) || String(plan.scopeStage).trim() || null;
      }
      if (!planGrade && scopeType === 'GRADE' && plan.scopeValue) {
        planGrade = normalizeLevel(plan.scopeValue) || String(plan.scopeValue).trim() || null;
      }
      if (planGrade && studentGrade && planGrade !== studentGrade) continue;

      if (scopeType === 'ALL' || scopeType === 'GRADE' || scopeType === 'STAGE') {
        return { ok: true, via: 'subscription', scope: 'all', planId: plan.id, subscriptionId: sub.id };
      }

      if ((scopeType === 'CATEGORY' || scopeType === 'SUBJECT') && examCategory && categoryMatches(plan.scopeValue, examCategory)) {
        return { ok: true, via: 'subscription', scope: 'category', planId: plan.id, subscriptionId: sub.id };
      }
    }

    return { ok: false, via: null, reason: 'NO_ACCESS' };
  }

  return { ok: false, via: null, reason: 'UNSUPPORTED_RESOURCE' };
}

/** canAccessCourse wrapper */
export async function canAccessCourse({ models, studentId, courseId }) {
  const result = await hasEntitlement({ models, studentId, resource: { type: 'COURSE', id: courseId } });
  if (!result.ok) return { ok: false, reason: result.reason || 'NO_ACCESS' };
  return result;
}

/** canAccessLesson wrapper */
export async function canAccessLesson({ models, studentId, courseId, lessonId }) {
  const Lesson = resolveMysqlModel(models, 'Lesson');
  if (!Lesson || typeof Lesson.findOne !== 'function') {
    return { ok: false, reason: 'LESSON_MODEL_MISSING' };
  }

  const lesson = await Lesson.findOne({ where: { id: lessonId, courseId, isDeleted: false } });
  if (!lesson) return { ok: false, reason: 'LESSON_NOT_FOUND' };

  if (lesson.isFreePreview) return { ok: true, via: 'FREE_PREVIEW', lessonId };

  const courseResult = await canAccessCourse({ models, studentId, courseId });
  if (!courseResult.ok) return { ok: false, reason: courseResult.reason || 'NO_ACCESS' };

  return { ...courseResult, lessonId };
}
