// src/routes/certificates.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   - name: Certificates
 *     description: إدارة شهادات الطلاب (عرض الشهادات وإنشاؤها)
 *
 * components:
 *   schemas:
 *     StudentCertificate:
 *       type: object
 *       description: شهادة طالب مخزّنة في النظام
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [exam, course, behavior, other]
 *         issuedBy:
 *           type: string
 *         issuedAt:
 *           type: string
 *           format: date-time
 *         reason:
 *           type: string
 *           nullable: true
 *         course:
 *           type: string
 *           nullable: true
 *         score:
 *           type: number
 *           nullable: true
 *         maxScore:
 *           type: number
 *           nullable: true
 *         metaJson:
 *           type: string
 *           nullable: true
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     StudentCertificateCreateInput:
 *       type: object
 *       required:
 *         - studentId
 *         - title
 *       properties:
 *         studentId:
 *           type: integer
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [exam, course, behavior, other]
 *         issuedBy:
 *           type: string
 *           nullable: true
 *         issuedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         reason:
 *           type: string
 *           nullable: true
 *         course:
 *           type: string
 *           nullable: true
 *         score:
 *           type: number
 *           nullable: true
 *         maxScore:
 *           type: number
 *           nullable: true
 *         meta:
 *           type: object
 *           nullable: true
 */

function safeCert(row) {
  return row?.toJSON ? row.toJSON() : row || {};
}

// helper بسيط للتواريخ
function toSafeDate(value) {
  if (!value && value !== 0) return null;

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function createCertificatesRouter(models) {
  const router = Router();

  const {
    StudentMysql,
    Student,
    StudentCertificateMysql,
    StudentCertificate,
  } = models;

  // توحيد أسماء الموديلات زي centers.routes
  const StudentModel =
    StudentMysql ||
    Student ||
    models.StudentMysql ||
    models.Student ||
    null;

  const StudentCertificateModel =
    StudentCertificateMysql ||
    StudentCertificate ||
    models.StudentCertificateMysql ||
    models.StudentCertificate ||
    null;

  if (!StudentCertificateModel || !StudentModel) {
    throw new Error(
      'Certificates router: required models not configured (Student / StudentCertificate)',
    );
  }

  // ===== GET /certificates/me =====
  // شهادات الطالب الحالي
  /**
   * @swagger
   * /certificates/me:
   *   get:
   *     summary: شهادات الطالب الحالي
   *     description: يرجع جميع الشهادات الخاصة بالطالب المرتبط بالـ JWT الحالي. متاح فقط للمستخدمين بدور student.
   *     tags: [Certificates]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      if (String(req.user?.role || '').toLowerCase() !== 'student') {
        return res
          .status(403)
          .json({ success: false, message: 'مصرّح للطلاب فقط' });
      }

      const studentId = Number(req.user.id);
      if (!studentId) {
        return res
          .status(400)
          .json({ success: false, message: 'studentId غير صالح' });
      }

      const rows = await StudentCertificateModel.findAll({
        where: { studentId },
        order: [
          ['issuedAt', 'DESC'],
          ['id', 'DESC'],
        ],
      });

      return res.json({
        success: true,
        data: rows.map(safeCert),
      });
    } catch (e) {
      console.error('Error in GET /certificates/me', e);
      next(e);
    }
  });

  // ===== GET /certificates/student/:id =====
  // شهادات طالب معيّن (للمدرّس / الأدمن)
  /**
   * @swagger
   * /certificates/student/{id}:
   *   get:
   *     summary: جلب شهادات طالب معيّن
   *     tags: [Certificates]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/student/:id',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const studentId = Number(req.params.id);
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: 'studentId غير صالح' });
        }

        const student = await StudentModel.findByPk(studentId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: 'الطالب غير موجود' });
        }

        const rows = await StudentCertificateModel.findAll({
          where: { studentId },
          order: [
            ['issuedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        });

        return res.json({
          success: true,
          data: rows.map(safeCert),
        });
      } catch (e) {
        console.error('Error in GET /certificates/student/:id', e);
        next(e);
      }
    },
  );

  // ===== POST /certificates =====
  // إنشاء شهادة لطالب (أدمن / Teacher)
  /**
   * @swagger
   * /certificates:
   *   post:
   *     summary: إنشاء شهادة جديدة لطالب
   *     tags: [Certificates]
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/',
    requireAuth,
    requireRole('teacher', 'admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const {
          studentId,
          title,
          description,
          type,
          issuedBy,
          issuedAt,
          reason,
          course,
          score,
          maxScore,
          meta,
        } = req.body || {};

        if (!studentId || !title) {
          return res.status(400).json({
            success: false,
            message: 'studentId و title مطلوبان',
          });
        }

        const numericStudentId = Number(studentId);
        if (!numericStudentId) {
          return res
            .status(400)
            .json({ success: false, message: 'studentId غير صالح' });
        }

        const student = await StudentModel.findByPk(numericStudentId);
        if (!student) {
          return res
            .status(404)
            .json({ success: false, message: 'الطالب غير موجود' });
        }

        const allowedTypes = ['exam', 'course', 'behavior', 'other'];
        const certType = allowedTypes.includes(type) ? type : 'other';

        const now = new Date();
        const issuedAtDate = toSafeDate(issuedAt) || now;

        const data = {
          studentId: numericStudentId,
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          type: certType,
          issuedBy: issuedBy ? String(issuedBy).trim() : 'منصة المبدع',
          issuedAt: issuedAtDate,
          reason: reason ? String(reason).trim() : null,
          course: course ? String(course).trim() : null,
          score: score != null ? Number(score) : null,
          maxScore: maxScore != null ? Number(maxScore) : null,
          metaJson: meta ? JSON.stringify(meta) : null,
          createdAtLocal: now,
          updatedAtLocal: now,
        };

        const created = await StudentCertificateModel.create(data);

        return res.json({
          success: true,
          data: safeCert(created),
        });
      } catch (e) {
        console.error('Error in POST /certificates', e);
        next(e);
      }
    },
  );

  // ===== GET /certificates =====
  // جلب جميع الشهادات للإدارة
  router.get(
    '/',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res, next) => {
      try {
        const { q, type } = req.query;
        
        const where = {};
        if (type) {
          where.type = type;
        }

        if (q) {
          const students = await StudentModel.findAll({
            where: {
              [Op.or]: [
                { studentName: { [Op.like]: `%${q}%` } },
                { centerCode: { [Op.like]: `%${q}%` } }
              ]
            },
            attributes: ['id']
          });
          const ids = students.map(s => s.id);
          
          where[Op.or] = [
            { title: { [Op.like]: `%${q}%` } },
            { studentId: ids }
          ];
        }

        const rows = await StudentCertificateModel.findAll({
          where,
          order: [['issuedAt', 'DESC'], ['id', 'DESC']],
        });
        
        const studentIds = [...new Set(rows.map(r => r.studentId))];
        const students = await StudentModel.findAll({
          where: { id: studentIds },
          attributes: ['id', 'studentName', 'centerCode', 'studentPhone']
        });
        const studentMap = {};
        for(const s of students) {
          studentMap[s.id] = {
            id: s.id,
            studentName: s.studentName,
            centerCode: s.centerCode,
            phone: s.studentPhone || s.phone || s.mobile
          };
        }

        const data = rows.map(r => {
          const cert = safeCert(r);
          cert.student = studentMap[cert.studentId] || null;
          return cert;
        });

        return res.json({
          success: true,
          data,
          count: data.length
        });
      } catch (e) {
        console.error('Error in GET /certificates', e);
        next(e);
      }
    }
  );

  // ===== PATCH /certificates/:id =====
  router.patch('/:id', requireAuth, requireRole('teacher', 'admin', 'supervisor'), async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const cert = await StudentCertificateModel.findByPk(id);
        if (!cert) return res.status(404).json({ success: false, message: 'الشهادة غير موجودة' });
        
        const fields = ['title', 'description', 'type', 'issuedBy', 'issuedAt', 'reason', 'course', 'score', 'maxScore', 'meta'];
        for(const f of fields) {
            if (req.body[f] !== undefined) {
               if (f === 'issuedAt') cert.issuedAt = toSafeDate(req.body[f]) || cert.issuedAt;
               else if (f === 'meta') cert.metaJson = req.body[f] ? JSON.stringify(req.body[f]) : null;
               else cert[f] = req.body[f];
            }
        }
        cert.updatedAtLocal = new Date();
        await cert.save();
        
        return res.json({ success: true, data: safeCert(cert) });
      } catch(e) { next(e); }
  });

  // ===== DELETE /certificates/:id =====
  router.delete('/:id', requireAuth, requireRole('admin', 'supervisor'), async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const cert = await StudentCertificateModel.findByPk(id);
        if (!cert) return res.status(404).json({ success: false, message: 'الشهادة غير موجودة' });
        
        await cert.destroy();
        return res.json({ success: true, message: 'تم الحذف' });
      } catch(e) { next(e); }
  });

  // ===== GET /certificates/:id/preview =====
  router.get('/:id/preview', async (req, res, next) => {
     try {
        const id = Number(req.params.id);
        const cert = await StudentCertificateModel.findByPk(id);
        if (!cert) return res.status(404).send('الشهادة غير موجودة');
        
        const student = await StudentModel.findByPk(cert.studentId);
        const studentName = student ? student.studentName : 'طالب';
        
        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>شهادة تقدير - \${studentName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Aref+Ruqaa:wght@400;700&display=swap');
        body {
            margin: 0; padding: 0; background: #e2e8f0; font-family: 'Cairo', sans-serif;
            display: flex; justify-content: center; align-items: center; min-height: 100vh;
        }
        .cert-container {
            width: 297mm; height: 210mm; /* A4 Landscape */
            background: #fff; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden; text-align: center; color: #1e293b;
            box-sizing: border-box; padding: 40px;
        }
        @media print {
            @page { size: A4 landscape; margin: 0; }
            body { background: #fff; margin: 0; }
            .cert-container { box-shadow: none; width: 297mm; height: 210mm; page-break-after: avoid; }
            .print-btn { display: none !important; }
        }
        .border-inner {
            border: 15px solid #0f172a; padding: 40px; height: 100%; box-sizing: border-box;
            position: relative; border-radius: 20px;
        }
        .header { margin-bottom: 30px; }
        .header h1 { font-family: 'Aref Ruqaa', serif; font-size: 60px; color: #b45309; margin: 0; }
        .header h2 { font-size: 24px; color: #475569; margin: 5px 0 0; text-transform: uppercase; letter-spacing: 2px; }
        .content { margin-top: 40px; }
        .content p { font-size: 24px; color: #64748b; margin-bottom: 20px; }
        .student-name { font-family: 'Aref Ruqaa', serif; font-size: 56px; color: #0f172a; margin: 20px 0; font-weight: bold; border-bottom: 2px dashed #cbd5e1; display: inline-block; padding: 0 40px; }
        .reason { font-size: 28px; color: #334155; font-weight: bold; margin-top: 30px; }
        .score { font-size: 20px; color: #059669; font-weight: bold; margin-top: 15px; }
        .footer { position: absolute; bottom: 50px; width: calc(100% - 80px); display: flex; justify-content: space-between; align-items: flex-end; }
        .signature { text-align: center; }
        .signature div { border-top: 2px solid #0f172a; width: 200px; padding-top: 10px; font-weight: bold; font-size: 18px; }
        .date { font-size: 18px; font-weight: bold; color: #64748b; }
        .print-btn { position: fixed; top: 20px; right: 20px; background: #2563eb; color: #fff; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-family: 'Cairo'; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: 0.3s; z-index: 100; }
        .print-btn:hover { background: #1d4ed8; }
        .stamp { position: absolute; top: 50px; right: 50px; width: 120px; height: 120px; border: 4px solid #b45309; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: 900; color: #b45309; opacity: 0.3; transform: rotate(-15deg); font-size: 24px; }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ طباعة الشهادة كـ PDF</button>
    <div class="cert-container">
        <div class="border-inner">
            <div class="stamp">EXCELLENCE</div>
            <div class="header">
                <h1>شهادة تقدير</h1>
                <h2>Certificate of Excellence</h2>
            </div>
            <div class="content">
                <p>تتشرف إدارة المنصة بأن تمنح هذه الشهادة للطالب/ة</p>
                <div class="student-name">${studentName}</div>
                <div class="reason">تقديراً لـ: ${cert.title}</div>
                ${cert.reason ? `<div style="font-size: 20px; color: #64748b; margin-top: 10px;">${cert.reason}</div>` : ''}
                ${cert.score != null ? `<div class="score">الدرجة: ${cert.score} / ${cert.maxScore || 100}</div>` : ''}
            </div>
            <div class="footer">
                <div class="date">تاريخ الإصدار: ${new Date(cert.issuedAt).toLocaleDateString('ar-EG')}</div>
                <div class="signature">
                    <div>توقيع الإدارة</div>
                    <span style="display:block; margin-top: 5px; color:#b45309;">${cert.issuedBy || 'منصة المبدع'}</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
     } catch(e) { next(e); }
  });

  router.get('/:id/pdf', (req, res) => {
      res.redirect(`/api/v1/certificates/${req.params.id}/preview`);
  });

  return router;
}
