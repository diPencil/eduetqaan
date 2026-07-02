// src/routes/clients.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * @swagger
 * tags:
 *   - name: Clients
 *     description: إدارة العملاء / الـ leads (للوحة التحكم)
 *
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       description: كيان عميل / lead في المنصّة
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *           nullable: true
 *           description: اسم العميل
 *         phone:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     CreateClientInput:
 *       type: object
 *       description: بيانات إنشاء عميل جديد (مرنة حسب الـ model الفعلي)
 *       properties:
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         notes:
 *           type: string
 *
 *     UpdateClientInput:
 *       type: object
 *       description: أي حقول مسموح تعديلها في العميل
 *       properties:
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         notes:
 *           type: string
 */

function safeClient(row) {
  if (!row) return row;
  return typeof row.toJSON === 'function' ? row.toJSON() : row;
}

export function createClientsRouter(models) {
  const router = Router();
  const ClientMysql = models.ClientMysql || models.Client;

  /**
   * @swagger
   * /clients:
   *   get:
   *     summary: استرجاع قائمة العملاء
   *     description: يرجع كل العملاء المخزّنين (بدون pagination حالياً).
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة العملاء
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
   *                     $ref: '#/components/schemas/Client'
   */
  router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const rows = await ClientMysql.findAll({ order: [['id', 'ASC']] });
        res.json({
          success: true,
          data: rows.map(safeClient),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /clients:
   *   post:
   *     summary: إنشاء عميل جديد
   *     description: إنشاء سجل عميل (lead) جديد في النظام.
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateClientInput'
   *     responses:
   *       200:
   *         description: تم إنشاء العميل
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Client'
   */
  router.post(
    '/',
    requireAuth,
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const data = req.body || {};
        const created = await ClientMysql.create(data);
        res.json({ success: true, data: safeClient(created) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /clients/{id}:
   *   put:
   *     summary: تعديل بيانات عميل
   *     description: تحديث بيانات عميل موجود بالكامل (full update).
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم العميل
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateClientInput'
   *     responses:
   *       200:
   *         description: تم تحديث بيانات العميل
   *       400:
   *         description: id غير صالح
   *       404:
   *         description: العميل غير موجود
   */
  router.put(
    '/:id',
    requireAuth,
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: 'id غير صالح' });
        }

        const data = req.body || {};

        const [affected] = await ClientMysql.update(data, {
          where: { id },
        });

        if (!affected) {
          return res
            .status(404)
            .json({ success: false, message: 'العميل غير موجود' });
        }

        const updated = await ClientMysql.findByPk(id);

        res.json({ success: true, data: safeClient(updated) });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /clients/{id}:
   *   delete:
   *     summary: حذف عميل
   *     description: حذف عميل (قد تكون delete فعلية أو soft حسب تنفيذ الـ model).
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم العميل
   *     responses:
   *       200:
   *         description: تم حذف العميل
   *       400:
   *         description: id غير صالح
   *       404:
   *         description: العميل غير موجود
   */
  router.delete(
    '/:id',
    requireAuth,
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: 'id غير صالح' });
        }

        const deletedCount = await ClientMysql.destroy({ where: { id } });

        if (!deletedCount) {
          return res
            .status(404)
            .json({ success: false, message: 'العميل غير موجود' });
        }

        res.json({ success: true, data: { id, deleted: true } });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
