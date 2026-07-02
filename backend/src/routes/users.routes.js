// src/routes/users.routes.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: مستخدمو لوحة التحكم (أدمن / يوزر) – تسجيل الدخول، إنشاء المستخدمين، وجلب البيانات
 *
 * components:
 *   schemas:
 *     AdminUserSafe:
 *       type: object
 *       description: بيانات المستخدم الإداري (بدون passwordHash).
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [admin, user]
 *         isActive:
 *           type: boolean
 *         createdAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     BootstrapAdminRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           description: كلمة سر لا تقل عن 6 أحرف.
 *
 *     UserCreateRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           description: كلمة سر لا تقل عن 6 أحرف.
 *         role:
 *           type: string
 *           enum: [admin, supervisor, center_manager, support]
 *           description: إن لم تُرسل، القيمة الافتراضية support.
 *
 *     UserCreateResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/AdminUserSafe'
 *
 *     UserLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *
 *     UserLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/AdminUserSafe'
 *         token:
 *           type: string
 *           description: "JWT يستعمل مع Authorization: Bearer."
 */

function issueToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  const expiresIn = process.env.JWT_EXPIRES || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

export default function createUsersRouter(models) {
  const router = Router();

  // ✅ Use the Smart Proxy Model (User) which handles MySQL-to-SQLite failover
  const User = models.User;

  if (!User) {
    console.warn('⚠️ User model not configured on server (users.routes.js)');
  }

  // ===== Bootstrap أول أدمن لو مفيش مستخدمين =====
  /**
   * @swagger
   * /users/bootstrap-admin:
   *   post:
   *     summary: تهيئة أول مستخدم أدمن في النظام
   *     description: >
   *       يستخدم مرة واحدة فقط عند خلو جدول المستخدمين، لإنشاء أول حساب أدمن في النظام.
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BootstrapAdminRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء الأدمن الأول وإرجاع JWT له.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 token:
   *                   type: string
   *       400:
   *         description: تم التهيئة بالفعل أو بيانات غير صالحة.
   */
  router.post('/bootstrap-admin', async (req, res, next) => {
    try {
      if (!User) {
        return res.status(500).json({
          success: false,
          error: 'User model not configured on server',
        });
      }

      const count = await User.count();
      if (count > 0) {
        return res
          .status(400)
          .json({ success: false, message: 'تم التهيئة بالفعل' });
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'أدخِل بريدًا صحيحًا وكلمة سر ≥ 6',
        });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const data = {
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
        updatedAtLocal: new Date(),
      };

      const created = await User.create(data);

      const token = issueToken({
        id: created.id,
        role: 'admin',
        email,
        name: 'Admin', // Default for first admin
      });
      res.json({ success: true, message: 'تم إنشاء الأدمن', token });
    } catch (e) {
      next(e);
    }
  });

  // ===== إنشاء مستخدم (أدمن فقط) =====
  /**
   * @swagger
   * /users:
   *   post:
   *     summary: إنشاء مستخدم لوحة تحكم جديد (أدمن فقط)
   *     description: يقوم الأدمن بإنشاء مستخدم جديد بدور admin أو user.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserCreateRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء المستخدم بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserCreateResponse'
   *       400:
   *         description: إيميل أو كلمة سر غير صالحة.
   *       401:
   *         description: غير مصرح (بدون توكن/توكن غير صالح).
   *       403:
   *         description: يتطلّب صلاحية أدمن.
   *       409:
   *         description: البريد مستخدم بالفعل.
   */
  router.post(
    '/',
    requireAuth,
    requireRole('admin', 'supervisor'),
    async (req, res, next) => {
      try {
        if (!User) {
          return res.status(500).json({
            success: false,
            error: 'User model not configured on server',
          });
        }

        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const allowedRoles = ['admin', 'supervisor', 'center_manager', 'support'];
        const role = allowedRoles.includes(String(req.body?.role))
          ? String(req.body.role)
          : 'support'; // Default to support if invalid

        if (!email || password.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'أدخِل بريدًا صحيحًا وكلمة سر ≥ 6',
          });
        }

        const exists = await User.findOne({ where: { email } });
        if (exists) {
          return res
            .status(409)
            .json({ success: false, message: 'البريد مستخدم بالفعل' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const data = {
          email,
          passwordHash,
          role,
          centerId: req.body?.centerId || null, // ⚡ NEW
          isActive: true,
          updatedAtLocal: new Date(),
        };

        const created = await User.create(data);

        res.json({
          success: true,
          data: {
            id: created.id,
            email,
            role,
            isActive: true,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // ===== تسجيل الدخول =====
  /**
   * @swagger
   * /users/login:
   *   post:
   *     summary: تسجيل دخول مستخدم لوحة التحكم
   *     tags: [Users]
   *     description: >
   *       تسجيل الدخول باستخدام البريد الإلكتروني وكلمة السر، وإرجاع JWT في الحقل `token`.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserLoginRequest'
   *     responses:
   *       200:
   *         description: تم تسجيل الدخول بنجاح.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserLoginResponse'
   *       400:
   *         description: بريد أو كلمة سر ناقصة.
   *       401:
   *         description: بيانات غير صحيحة أو مستخدم غير نشط.
   */
  router.post('/login', async (req, res, next) => {
    try {
      if (!User) {
        return res.status(500).json({
          success: false,
          error: 'User model not configured on server',
        });
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!email || !password) {
        return res
          .status(400)
          .json({ success: false, message: 'أدخل البريد وكلمة السر' });
      }

      const user = await User.findOne({
        where: { email, isActive: true },
      });
      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: 'بيانات غير صحيحة' });
      }

      const ok = bcrypt.compareSync(password, user.passwordHash || '');
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, message: 'بيانات غير صحيحة' });
      }

      const token = issueToken({
        id: user.id,
        role: user.role,
        email: user.email,
        name: user.name, // ⚡ ADDED for auditing
        centerId: user.centerId,
      });
      res.json({
        success: true,
        data: { id: user.id, email: user.email, role: user.role },
        token,
      });
    } catch (e) {
      next(e);
    }
  });

  // ===== أنا =====
  /**
   * @swagger
   * /users/me:
   *   get:
   *     summary: معلومات المستخدم الحالي (من التوكن)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: بيانات المستخدم المستخرجة من الـ JWT.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 me:
   *                   type: object
   *                   description: Payload التوكن (id, role, email).
   *       401:
   *         description: غير مصرح.
   */
  router.get('/me', requireAuth, (req, res) => {
    res.json({ success: true, me: req.user });
  });

  // ===== قائمة المستخدمين (أدمن) =====
  /**
   * @swagger
   * /users:
   *   get:
   *     summary: قائمة مستخدمي لوحة التحكم (أدمن فقط)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة بكل المستخدمين الإداريين.
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
   *                     $ref: '#/components/schemas/AdminUserSafe'
   *       401:
   *         description: غير مصرح.
   *       403:
   *         description: يتطلّب صلاحية أدمن.
   */
  router.get(
    '/',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager'),
    async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        const userCenterId = req.user?.centerId;

        if (!User) {
          return res.status(500).json({
            success: false,
            error: 'User model not configured on server',
          });
        }

        const where = {};
        if (userRole === 'center_manager' && userCenterId) {
          where.centerId = userCenterId;
        }

        const rows = await User.findAll({
          where,
          order: [['id', 'ASC']],
          attributes: [
            'id',
            'email',
            'role',
            'isActive',
            'createdAtLocal',
            'updatedAtLocal',
          ],
        });
        res.json({ success: true, data: rows });
      } catch (e) {
        next(e);
      }
    }
  );

  // ===== تعديل مستخدم =====
  router.patch(
    '/:id',
    requireAuth,
    requireRole('admin', 'supervisor'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) {
          return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const allowedFields = ['email', 'role', 'isActive', 'centerId'];
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            user[field] = req.body[field];
          }
        }

        if (req.body.password && req.body.password.length >= 6) {
          user.passwordHash = bcrypt.hashSync(req.body.password, 10);
        }

        user.updatedAtLocal = new Date();
        await user.save();

        res.json({ success: true, data: { id: user.id, email: user.email, role: user.role, isActive: user.isActive, centerId: user.centerId } });
      } catch (e) {
        next(e);
      }
    }
  );

  // ===== حذف مستخدم =====
  router.delete(
    '/:id',
    requireAuth,
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) {
          return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        await user.destroy();
        res.json({ success: true, message: 'تم الحذف بنجاح' });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
