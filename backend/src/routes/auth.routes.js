// src/routes/auth.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';

function safeStudent(s) {
  const j = typeof s?.toJSON === 'function' ? s.toJSON() : s || {};
  const { passwordHash, ...rest } = j;
  return rest;
}

export function createAuthRouter(models) {
  const router = Router();

  const { StudentMysql, Student } = models;
  const StudentModel = StudentMysql || Student;

  if (!StudentModel) {
    throw new Error('Student model (Student/StudentMysql) is not configured');
  }

  /**
   * GET /api/v1/auth/me
   * يرجّع بيانات اليوزر الحالي حسب الـ JWT (requireAuth)
   */
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const userId = Number(req.user?.id);
      const role = req.user?.role;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: 'غير مسجل الدخول' });
      }

      // حالياً بندعم الطلاب فقط
      if (role === 'student') {
        const student = await StudentModel.findByPk(userId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: 'الحساب غير موجود' });
        }

        return res.json({
          success: true,
          data: safeStudent(student),
        });
      }

      // لو حابب بعدين تزود teacher/admin هنا
      return res.status(400).json({
        success: false,
        message: 'نوع المستخدم غير مدعوم في /auth/me حالياً',
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export default createAuthRouter;
