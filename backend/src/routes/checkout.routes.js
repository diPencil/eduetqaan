// src/routes/checkout.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { canAccessCourse, hasEntitlement } from "../services/access.js";
import { decodeId } from "../utils/hash.js"; // ⚡ NEW

import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import r2Client from "../lib/r2-client.js";

/**
 * @swagger
 * tags:
 *   - name: Checkout
 *     description: مسارات الدفع، الاشتراكات، والمحفظة (كورسات وباقات)
 *
 * components:
 *   schemas:
 *     CheckoutPurchaseCourseInput:
 *       type: object
 *       required:
 *         - courseId
 *       properties:
 *         courseId:
 *           type: integer
 *           description: رقم الكورس المطلوب شراؤه
 *
 *     CheckoutWalletCourseInput:
 *       type: object
 *       required:
 *         - courseId
 *       properties:
 *         courseId:
 *           type: integer
 *           description: رقم الكورس المطلوب دفعه من المحفظة
 *
 *     CheckoutWalletPlanInput:
 *       type: object
 *       required:
 *         - planId
 *       properties:
 *         planId:
 *           type: integer
 *           description: رقم خطة الاشتراك المطلوب دفعها من المحفظة
 *
 *     CheckoutManualConfirmInput:
 *       type: object
 *       required:
 *         - orderId
 *       properties:
 *         orderId:
 *           type: integer
 *           description: رقم الطلب المراد تأكيد دفعه يدويًا
 *
 *     CheckoutManualRejectInput:
 *       type: object
 *       required:
 *         - orderId
 *       properties:
 *         orderId:
 *           type: integer
 *           description: رقم الطلب المراد رفضه
 *
 *     CheckoutSubscribePlanInput:
 *       type: object
 *       required:
 *         - planId
 *       properties:
 *         planId:
 *           type: integer
 *           description: رقم خطة الاشتراك المطلوب الاشتراك بها (دفع يدوي)
 *
 *     CheckoutConfirmSubscriptionInput:
 *       type: object
 *       required:
 *         - orderId
 *       properties:
 *         orderId:
 *           type: integer
 *           description: رقم الطلب المرتبط بخطة اشتراك يراد تفعيلها
 *
 *     CheckoutClaimCourseFromQuotaInput:
 *       type: object
 *       required:
 *         - courseId
 *       properties:
 *         courseId:
 *           type: integer
 *           description: رقم الكورس المطلوب استهلاكه من باقة QUOTA
 *
 *     ManualOrderItemRow:
 *       type: object
 *       description: عنصر طلب دفع يدوي واحد للعرض في لوحة التحكم
 *       properties:
 *         id:
 *           type: integer
 *         orderId:
 *           type: integer
 *         studentId:
 *           type: integer
 *           nullable: true
 *         student:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *               nullable: true
 *             phone:
 *               type: string
 *               nullable: true
 *             year:
 *               type: string
 *               nullable: true
 *         itemType:
 *           type: string
 *           enum: [COURSE, PLAN]
 *         itemId:
 *           type: integer
 *         itemTitle:
 *           type: string
 *         amountCents:
 *           type: integer
 *         currency:
 *           type: string
 *           example: EGP
 *         paymentMethod:
 *           type: string
 *           nullable: true
 *         orderStatus:
 *           type: string
 *         paymentStatus:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         proofImageUrl:
 *           type: string
 *           nullable: true
 *
 *     AccessCourseResult:
 *       type: object
 *       description: نتيجة استعلام صلاحية الدخول لكورس
 *       properties:
 *         ok:
 *           type: boolean
 *         via:
 *           type: string
 *           nullable: true
 *           description: مصدر الصلاحية (شراء، اشتراك، باقة، ..)
 *         reason:
 *           type: string
 *           nullable: true
 *
 *     MySubscriptionPlan:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         planId:
 *           type: integer
 *         status:
 *           type: string
 *         startsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         activeNow:
 *           type: boolean
 */

// helper بسيط لتواريخ آمنة في الـ JSON
function toIsoSafe(value) {
  if (!value && value !== 0) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function createCheckoutRouter(models) {
  const router = Router();
  // ✅ Aliases مرنة للأسماء المختلفة للموديلات


  const StudentModel = models.StudentMysql || models.Student || models.StudentModel;
  const CourseModel = models.CourseMysql || models.Course || models.CourseModel;
  const OrderModel = models.OrderMysql || models.Order || models.OrderModel;
  const OrderItemModel = models.OrderItemMysql || models.OrderItem || models.OrderItemModel;
  const PaymentModel = models.PaymentMysql || models.Payment || models.PaymentModel;
  const EnrollmentModel = models.EnrollmentMysql || models.Enrollment || models.EnrollmentModel;
  const PlanModel = models.PlanMysql || models.Plan || models.PlanModel;
  const SubscriptionModel = models.SubscriptionMysql || models.Subscription || models.SubscriptionModel;
  const WalletModel = models.WalletMysql || models.Wallet || models.WalletModel;
  const WalletTxModel = models.WalletTxMysql || models.WalletTx || models.WalletTxModel;
  const SubscriptionConsumptionModel = models.SubscriptionConsumptionMysql || models.SubscriptionConsumption || models.SubscriptionConsumptionModel;

  // Aliases for compatibility with existing code in this file
  const StudentMysql = StudentModel;
  const CourseMysql = CourseModel;
  const OrderMysql = OrderModel;
  const OrderItemMysql = OrderItemModel;
  const PaymentMysql = PaymentModel;
  const EnrollmentMysql = EnrollmentModel;
  const PlanMysql = PlanModel;
  const SubscriptionMysql = SubscriptionModel;
  const WalletMysql = WalletModel;
  const WalletTxMysql = WalletTxModel;
  const SubscriptionConsumptionMysql = SubscriptionConsumptionModel;
  const ManualOrderMysql = OrderModel; // In this project, ManualOrder is often just Order
  const Course = CourseModel;
  const Plan = PlanModel;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  const R2_BUCKET = process.env.R2_BUCKET;
  const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

  const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");
  if (STORAGE_DRIVER === "local" && !fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only images are allowed"));
    },
  });

  async function persistPaymentProof({ file, userId }) {
    const { buffer, mimetype, originalname } = file;
    const safeUserId = userId || "unknown";

    let finalBuffer = buffer;
    let finalMime = mimetype;
    let finalExt = path.extname(originalname).toLowerCase() || ".webp";

    if (mimetype.startsWith("image/")) {
      try {
        finalBuffer = await sharp(buffer)
          .rotate()
          .webp({ quality: 80 })
          .toBuffer();
        finalMime = "image/webp";
        finalExt = ".webp";
      } catch (err) {
        console.error("[checkout] sharp compression failed:", err);
      }
    }

    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${finalExt}`;

    if (STORAGE_DRIVER === "r2" && r2Client && R2_BUCKET) {
      const key = `payments/${safeUserId}/${fileName}`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: finalBuffer,
          ContentType: finalMime,
        })
      );
      return `${R2_PUBLIC_BASE_URL}/${key}`;
    }

    const folder = path.join(uploadsDir, "payments", String(safeUserId));
    await fs.promises.mkdir(folder, { recursive: true });
    await fs.promises.writeFile(path.join(folder, fileName), finalBuffer);

    return `${PUBLIC_BASE_URL}/uploads/payments/${safeUserId}/${fileName}`;
  }



  // -----------------------------------------------------------------------
  // POST /checkout/upload-proof
  // -----------------------------------------------------------------------
  router.post("/upload-proof", requireAuth, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const url = await persistPaymentProof({
        file: req.file,
        userId: req.user.id,
      });

      res.json({ success: true, data: { url } });
    } catch (e) {
      console.error("[checkout/upload-proof] error:", e);
      res.status(500).json({ success: false, message: "Failed to upload proof" });
    }
  });



  // دالة مساعدة: هل لدى الطالب اشتراك نشط في هذه الخطة؟
  async function hasActivePlanSubscription(studentId, planId) {
    if (!SubscriptionMysql) {
      throw new Error("Subscription model is not configured");
    }

    const subs = await SubscriptionMysql.findAll({
      where: { studentId, planId, status: "active" },
    });

    if (!subs.length) return false;

    const now = Date.now();
    return subs.some((s) => {
      const startMs = s.startsAt ? new Date(s.startsAt).getTime() : 0;
      const endMs = s.endsAt ? new Date(s.endsAt).getTime() : 0;

      if (!startMs && !endMs) return true;
      if (startMs && !endMs) return startMs <= now;
      if (!startMs && endMs) return now <= endMs;
      return startMs <= now && now <= endMs;
    });
  }



  // ---------------------------------
  // 0) الكورسات المملوكة/المسجّل فيها الطالب الحالي
  // ---------------------------------

  /**
   * @swagger
   * /checkout/my-courses:
   *   get:
   *     summary: الكورسات المملوكة للطالب الحالي
   *     description: يرجع كل الكورسات اللي الطالب عنده Enrollment عليها (سواء شراء أو اشتراك).
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الكورسات
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
   *                       courseId:
   *                         type: integer
   *                       title:
   *                         type: string
   *                       slug:
   *                         type: string
   *                         nullable: true
   *                       coverImageUrl:
   *                         type: string
   *                         nullable: true
   *                       level:
   *                         type: string
   *                         nullable: true
   *                       source:
   *                         type: string
   *                         description: مصدر الصلاحية (purchase / subscription / quota ...)
   *                       enrolledAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   */
  router.get("/my-courses", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId) {
        return res
          .status(401)
          .json({ success: false, message: "غير مصرح" });
      }

      if (!EnrollmentMysql || !CourseMysql) {
        return res.status(500).json({
          success: false,
          message:
            "Enrollment / Course models are not configured for /checkout/my-courses",
        });
      }

      // 1) كل الـ enrollments للطالب
      const enrollments = await EnrollmentMysql.findAll({
        where: { studentId },
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      if (!enrollments.length) {
        return res.json({ success: true, data: [] });
      }

      // 2) نحتفظ بأحدث Enrollment لكل كورس
      const latestEnrollmentByCourse = new Map(); // courseId -> enrollment
      for (const enr of enrollments) {
        const cid = Number(enr.courseId);
        if (!cid) continue;

        const existing = latestEnrollmentByCourse.get(cid);
        const currentTs = new Date(
          enr.createdAt || enr.startsAt || enr.updatedAt || Date.now()
        ).getTime();
        const existingTs = existing
          ? new Date(
            existing.createdAt ||
            existing.startsAt ||
            existing.updatedAt ||
            0
          ).getTime()
          : 0;

        if (!existing || currentTs > existingTs) {
          latestEnrollmentByCourse.set(cid, enr);
        }
      }

      const courseIds = Array.from(latestEnrollmentByCourse.keys());
      if (!courseIds.length) {
        return res.json({ success: true, data: [] });
      }

      // 3) نجيب بيانات الكورسات
      const courses = await CourseMysql.findAll({
        where: { id: courseIds },
      });

      const courseMap = new Map(
        courses.map((c) => [Number(c.id), c])
      );

      // 4) نبني DTO للفرونت
      const result = [];
      for (const [courseId, enr] of latestEnrollmentByCourse.entries()) {
        const course = courseMap.get(courseId);
        if (!course || course.isDeleted) continue;

        const c = course.toJSON ? course.toJSON() : course;

        result.push({
          courseId,
          title: c.title || "",
          slug: c.slug || null,
          coverImageUrl:
            c.coverImageUrl || c.thumbnailUrl || c.imageUrl || null,
          level: c.level || c.year || null,
          source: enr.source || "enrollment",
          enrolledAt:
            toIsoSafe(
              enr.startsAt ||
              enr.createdAt ||
              enr.updatedAt ||
              enr.updatedAtLocal
            ) || null,
        });
      }

      // نرتب الأحدث أولاً
      result.sort((a, b) => {
        const ta = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
        const tb = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
        return tb - ta;
      });

      return res.json({ success: true, data: result });
    } catch (e) {
      console.error("Error in GET /checkout/my-courses", e);
      next(e);
    }
  });

  // ---------------------------------
  // 1) إنشاء طلب شراء كورس فردي (دفع يدوي/offline)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/purchase-course:
   *   post:
   *     summary: إنشاء طلب شراء كورس (دفع يدوي/أوفلاين)
   *     description: ينشئ Order + Payment لحجز كورس واحد بدفع يدوي، ويمكن أن يكون مجاني فيتم فتحه فورًا.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CheckoutPurchaseCourseInput'
   *     responses:
   *       200:
   *         description: تم إنشاء طلب الشراء بنجاح
   */
  router.post("/purchase-course", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      let courseId = Number(req.body?.courseId);
      if (isNaN(courseId)) {
        courseId = decodeId(req.body?.courseId);
      }
      if (!studentId || !courseId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const course = await CourseMysql.findByPk(courseId);
      if (!course || course.isDeleted) {
        return res
          .status(404)
          .json({ success: false, message: "الكورس غير موجود" });
      }

      const price = course.isFree ? 0 : course.priceCents || 0;
      const currency = "EGP";

      console.log("[checkout/purchase-course] Start. Body:", JSON.stringify(req.body));
      const bodyProof = req.body?.proofUrl || req.body?.proofImageUrl || null;
      console.log("[checkout/purchase-course] Extracted proof:", bodyProof);
      
      // 1) Order
      const order = await OrderMysql.create({
        studentId,
        status: price > 0 ? "pending" : "paid",
        totalCents: price,
        currency,
        provider: "manual",
        proofImageUrl: bodyProof,
        updatedAtLocal: new Date(),
      });
      console.log("[checkout/purchase-course] Order created. ID:", order.id, "proof:", order.proofImageUrl);

      // 2) OrderItem
      await OrderItemMysql.create({
        orderId: order.id,
        itemType: "COURSE",
        itemId: course.id,
        title: course.title,
        priceCents: price,
      });

      // 3) Payment
      const payment = await PaymentMysql.create({
        orderId: order.id,
        amountCents: price,
        currency,
        method: "manual_cash",
        status: price > 0 ? "pending" : "paid",
        provider: "manual",
        proofImageUrl: bodyProof,
        updatedAtLocal: new Date(),
      });
      console.log("[checkout/purchase-course] Payment created. ID:", payment.id, "proof:", payment.proofImageUrl);

      // FREE course? grant immediately
      if (price === 0) {
        const now = new Date();
        const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        await EnrollmentMysql.upsert({
          studentId,
          courseId,
          source: "purchase",
          startsAt: now,
          endsAt: endsAt,
          updatedAtLocal: now,
        });
      }

      return res.json({
        success: true,
        data: { orderId: order.id, paymentId: payment.id },
        nextAction: price > 0 ? "confirm-payment" : "access-granted",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 2) دفع فوري من المحفظة (COURSE)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/pay-with-wallet:
   *   post:
   *     summary: دفع فوري من المحفظة لكورس فردي
   *     description: يخصم من محفظة الطالب، ينشئ Order/Payment مدفوع، ويفعّل الـ Enrollment فورًا.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/pay-with-wallet", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      let courseId = Number(req.body?.courseId);
      if (isNaN(courseId)) {
        courseId = decodeId(req.body?.courseId);
      }
      if (!studentId || !courseId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      // ✅ 0) منع الشراء المكرر
      const accessInfo = await canAccessCourse({
        models,
        studentId,
        courseId,
      });
      if (accessInfo.ok) {
        return res.status(409).json({
          success: false,
          message: "أنت بالفعل تمتلك هذا الكورس",
          reason: accessInfo.via || "ALREADY_OWNED",
        });
      }

      // 1) الكورس
      const course = await CourseMysql.findByPk(courseId);
      if (!course || course.isDeleted) {
        return res
          .status(404)
          .json({ success: false, message: "الكورس غير موجود" });
      }

      const priceCents = course.isFree ? 0 : course.priceCents || 0;
      const currency = "EGP";

      // 2) المحفظة
      let wallet = await WalletMysql.findOne({
        where: { studentId },
      });
      if (!wallet) {
        return res.status(400).json({
          success: false,
          message: "لا توجد محفظة لهذا الطالب (اشحن أولاً)",
        });
      }

      // 3) تأكد من الرصيد
      if (priceCents > 0 && wallet.balanceCents < priceCents) {
        return res.status(400).json({
          success: false,
          message: "الرصيد غير كافٍ في المحفظة",
          walletBalanceCents: wallet.balanceCents,
          requiredCents: priceCents,
        });
      }

      // 4) Order مدفوع
      const order = await OrderMysql.create({
        studentId,
        status: "paid",
        totalCents: priceCents,
        currency,
        provider: "wallet_balance",
        updatedAtLocal: new Date(),
      });

      // 5) OrderItem
      await OrderItemMysql.create({
        orderId: order.id,
        itemType: "COURSE",
        itemId: course.id,
        title: course.title,
        priceCents: priceCents,
      });

      // 6) Payment مدفوع
      const payment = await PaymentMysql.create({
        orderId: order.id,
        amountCents: priceCents,
        currency,
        method: "wallet",
        status: "paid",
        provider: "wallet_balance",
        updatedAtLocal: new Date(),
      });

      // 7) خصم من المحفظة + WalletTx
      if (priceCents > 0) {
        const newBalance = wallet.balanceCents - priceCents;

        await wallet.update({
          balanceCents: newBalance,
          updatedAtLocal: new Date(),
        });

        await WalletTxMysql.create({
          walletId: wallet.id,
          type: "debit",
          reason: "COURSE_PURCHASE",
          amountCents: priceCents,
          refType: "ORDER",
          refId: order.id,
          createdAt: new Date(),
        });

        wallet.balanceCents = newBalance;
      }

      // 8) تفعيل الكورس
      const now = new Date();
      const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await EnrollmentMysql.upsert({
        studentId,
        courseId,
        source: "purchase",
        startsAt: now,
        endsAt: endsAt,
        updatedAtLocal: now,
      });

      return res.json({
        success: true,
        message: "تم الدفع وفتح الكورس",
        data: {
          orderId: order.id,
          paymentId: payment.id,
          newWalletBalanceCents: wallet.balanceCents,
        },
        nextAction: "access-granted",
      });
    } catch (e) {
      next(e);
    }
  });

  // 2-bis) دفع فوري من المحفظة لخطة اشتراك (PLAN)

  /**
   * @swagger
   * /checkout/pay-with-wallet/plan:
   *   post:
   *     summary: دفع من المحفظة لخطة اشتراك (PLAN)
   *     description: يخصم من محفظة الطالب ويفعّل اشتراك في خطة PLAN بنوعها (QUOTA أو غيرها).
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/pay-with-wallet/plan", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      const planId = Number(req.body?.planId);
      if (!studentId || !planId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const plan = await PlanMysql.findByPk(planId);
      if (!plan || !plan.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "الخطة غير متاحة" });
      }

      // ✅ منع اشتراك مكرر
      const alreadySub = await hasActivePlanSubscription(studentId, plan.id);
      if (alreadySub) {
        return res.status(409).json({
          success: false,
          message: "لديك اشتراك نشط بالفعل في هذه الباقة",
          reason: "ALREADY_SUBSCRIBED",
        });
      }

      // المحفظة
      let wallet = await WalletMysql.findOne({ where: { studentId } });
      if (!wallet) {
        return res.status(400).json({
          success: false,
          message: "لا توجد محفظة لهذا الطالب (اشحن أولاً)",
        });
      }

      const priceCents = plan.priceCents || 0;
      const currency = plan.currency || "EGP";

      if (priceCents > 0 && wallet.balanceCents < priceCents) {
        return res.status(400).json({
          success: false,
          message: "الرصيد غير كافٍ في المحفظة",
          walletBalanceCents: wallet.balanceCents,
          requiredCents: priceCents,
        });
      }

      // Order مدفوع
      const order = await OrderMysql.create({
        studentId,
        status: "paid",
        totalCents: priceCents,
        currency,
        provider: "wallet_balance",
        updatedAtLocal: new Date(),
      });

      // OrderItem: PLAN
      await OrderItemMysql.create({
        orderId: order.id,
        itemType: "PLAN",
        itemId: plan.id,
        title: plan.name,
        priceCents: priceCents,
      });

      // Payment
      const payment = await PaymentMysql.create({
        orderId: order.id,
        amountCents: priceCents,
        currency,
        method: "wallet",
        status: "paid",
        provider: "wallet_balance",
        updatedAtLocal: new Date(),
      });

      // خصم من المحفظة + WalletTx
      if (priceCents > 0) {
        const newBalance = wallet.balanceCents - priceCents;

        await wallet.update({
          balanceCents: newBalance,
          updatedAtLocal: new Date(),
        });

        await WalletTxMysql.create({
          walletId: wallet.id,
          type: "debit",
          reason: "PLAN_SUBSCRIPTION",
          amountCents: priceCents,
          refType: "ORDER",
          refId: order.id,
          createdAt: new Date(),
        });

        wallet.balanceCents = newBalance;
      }

      // إنشاء Subscription فوري
      const startsAt = new Date();
      const endsAt = new Date(
        startsAt.getTime() + (plan.periodDays || 30) * 86400_000
      );

      await SubscriptionMysql.create({
        studentId,
        planId: plan.id,
        status: "active",
        startsAt,
        endsAt,
        orderId: order.id,
        updatedAtLocal: new Date(),
      });

      return res.json({
        success: true,
        message: "تم الدفع من المحفظة وتفعيل الاشتراك",
        data: {
          orderId: order.id,
          paymentId: payment.id,
          newWalletBalanceCents: wallet.balanceCents,
        },
        nextAction: "access-granted",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 3) تأكيد دفع يدوي (أدمن/سنتر)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/manual/confirm:
   *   post:
   *     summary: تأكيد دفع يدوي لطلب كورس/خطة
   *     description: يغيّر حالة الـ Payment و Order إلى paid ويمنح الطالب الوصول للكورسات الموجودة في الطلب.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/manual/confirm", requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const orderId = Number(req.body?.orderId);
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "orderId مطلوب" });
      }

      const order = await OrderMysql.findByPk(orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "الطلب غير موجود" });
      }

      // mark payment + order as paid
      await PaymentMysql.update(
        { status: "paid", updatedAtLocal: new Date() },
        { where: { orderId } }
      );

      await OrderMysql.update(
        { status: "paid", updatedAtLocal: new Date() },
        { where: { id: orderId } }
      );

      // تفعيل الكورسات المرتبطة
      const items = await OrderItemMysql.findAll({
        where: { orderId, itemType: "COURSE" },
      });

      for (const it of items) {
        const now = new Date();
        const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        await EnrollmentMysql.upsert({
          studentId: order.studentId,
          courseId: it.itemId,
          source: "purchase",
          startsAt: now,
          endsAt: endsAt,
          updatedAtLocal: now,
        });
      }

      return res.json({
        success: true,
        message: "تم تأكيد الدفع ومنح الوصول",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 3-bis) رفض طلب يدوي (أدمن/سنتر)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/manual/reject:
   *   post:
   *     summary: رفض طلب دفع يدوي
   *     description: يضبط حالة الـ Payment إلى failed والـ Order إلى cancelled.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/manual/reject", requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const orderId = Number(req.body?.orderId);
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "orderId مطلوب" });
      }

      const order = await OrderMysql.findByPk(orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "الطلب غير موجود" });
      }

      await PaymentMysql.update(
        { status: "failed", updatedAtLocal: new Date() },
        { where: { orderId } }
      );

      await OrderMysql.update(
        { status: "canceled", updatedAtLocal: new Date() },
        { where: { id: orderId } }
      );

      return res.json({
        success: true,
        message: "تم رفض الطلب اليدوي.",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 4) الاشتراك في خطة (plan) manual
  // ---------------------------------

  /**
   * @swagger
   * /checkout/subscribe:
   *   post:
   *     summary: إنشاء طلب اشتراك في خطة (دفع يدوي)
   *     description: ينشئ Order/Payment لخطة اشتراك، ويمكن تفعيلها مباشرة لو الخطة مجانية.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/subscribe", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      const planId = Number(req.body?.planId);
      if (!studentId || !planId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const plan = await PlanMysql.findByPk(planId);
      if (!plan || !plan.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "الخطة غير متاحة" });
      }

      // ✅ منع اشتراك مكرر
      const alreadySub = await hasActivePlanSubscription(studentId, plan.id);
      if (alreadySub) {
        return res.status(409).json({
          success: false,
          message: "لديك اشتراك نشط بالفعل في هذه الباقة",
          reason: "ALREADY_SUBSCRIBED",
        });
      }

      const price = plan.priceCents || 0;
      const currency = plan.currency || "EGP";

      console.log("[checkout/subscribe] body:", req.body);
      const order = await OrderMysql.create({
        studentId,
        status: price > 0 ? "pending" : "paid",
        planId: plan.id,
        totalCents: price,
        currency,
        provider: "manual",
        proofImageUrl: req.body?.proofUrl || req.body?.proofImageUrl || null,
        updatedAtLocal: new Date(),
      });

      await OrderItemMysql.create({
        orderId: order.id,
        itemType: "PLAN",
        itemId: plan.id,
        title: plan.name,
        priceCents: price,
      });

      const payment = await PaymentMysql.create({
        orderId: order.id,
        amountCents: price,
        currency,
        method: "manual_cash",
        status: price > 0 ? "pending" : "paid",
        provider: "manual",
        proofImageUrl: req.body?.proofUrl || req.body?.proofImageUrl || null,
        updatedAtLocal: new Date(),
      });

      // مجاني → فعّل الاشتراك فورًا
      if (price === 0) {
        const startsAt = new Date();
        const endsAt = new Date(
          startsAt.getTime() + (plan.periodDays || 30) * 24 * 60 * 60 * 1000
        );

        await SubscriptionMysql.create({
          studentId,
          planId: plan.id,
          status: "active",
          startsAt,
          endsAt,
          orderId: order.id,
          updatedAtLocal: new Date(),
        });
      }

      return res.json({
        success: true,
        data: { orderId: order.id, paymentId: payment.id },
        nextAction: price > 0 ? "confirm-payment" : "access-granted",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 5) تأكيد يدوي لاشتراك (أدمن)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/manual/confirm-subscription:
   *   post:
   *     summary: تأكيد يدوي لاشتراك خطة (PLAN)
   *     description: يغير حالة الطلب والدفع إلى paid ثم ينشئ Subscription نشطًا لهذه الخطة.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/manual/confirm-subscription", requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const orderId = Number(req.body?.orderId);
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "orderId مطلوب" });
      }

      const order = await OrderMysql.findByPk(orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "الطلب غير موجود" });
      }

      const item = await OrderItemMysql.findOne({
        where: { orderId, itemType: "PLAN" },
      });
      if (!item) {
        return res.status(400).json({
          success: false,
          message: "العنصر ليس خطة اشتراك",
        });
      }

      const plan = await PlanMysql.findByPk(item.itemId);
      if (!plan) {
        return res
          .status(404)
          .json({ success: false, message: "الخطة غير موجودة" });
      }

      // mark paid
      await PaymentMysql.update(
        { status: "paid", updatedAtLocal: new Date() },
        { where: { orderId } }
      );
      await OrderMysql.update(
        { status: "paid", updatedAtLocal: new Date() },
        { where: { id: orderId } }
      );

      const startsAt = new Date();
      const endsAt = new Date(
        startsAt.getTime() + (plan.periodDays || 30) * 24 * 60 * 60 * 1000
      );

      await SubscriptionMysql.create({
        studentId: order.studentId,
        planId: plan.id,
        status: "active",
        startsAt,
        endsAt,
        orderId,
        updatedAtLocal: new Date(),
      });

      return res.json({
        success: true,
        message: "تم تفعيل الاشتراك",
      });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 6) قائمة طلبات الدفع اليدوي (للداشبورد)
  // ---------------------------------

  /**
   * @swagger
   * /checkout/manual/orders:
   *   get:
   *     summary: قائمة طلبات الدفع اليدوي (الإصدار الأول)
   *     description: يرجع قائمة الطلبات التي تمت عبر المزود manual مع إمكانية الفلترة بالـ status والنوع والبحث.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.get("/manual/orders", requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const statusRaw = String(req.query.status || "pending").toLowerCase();
      const status =
        ["pending", "paid", "failed", "all"].includes(statusRaw)
          ? statusRaw
          : "pending";

      const typeRaw = String(req.query.type || "ALL").toUpperCase();
      const type =
        ["ALL", "COURSE", "PLAN"].includes(typeRaw) ? typeRaw : "ALL";

      const page = Math.max(
        1,
        parseInt(String(req.query.page || "1"), 10) || 1
      );
      const pageSize = Math.min(
        50,
        Math.max(1, parseInt(String(req.query.pageSize || "20"), 10) || 20)
      );
      const offset = (page - 1) * pageSize;

      const search = String(req.query.search || "").trim().toLowerCase();

      const paymentWhere = { provider: "manual" };
      if (status !== "all") {
        paymentWhere.status = status;
      }

      const { rows: payments, count } = await PaymentMysql.findAndCountAll({
        where: paymentWhere,
        order: [["createdAt", "DESC"]],
        offset,
        limit: pageSize,
      });

      const rows = [];

      for (const p of payments) {
        const order = await OrderMysql.findByPk(p.orderId);
        if (!order) continue;
        if (order.provider !== "manual") continue;

        const items = await OrderItemMysql.findAll({
          where: { orderId: order.id },
        });
        if (!items.length) continue;

        let filteredItems = items;
        if (type !== "ALL") {
          filteredItems = items.filter(
            (it) => String(it.itemType).toUpperCase() === type
          );
          if (!filteredItems.length) continue;
        }

        const mainItem = filteredItems[0];

        const student = order.studentId
          ? await StudentMysql.findByPk(order.studentId)
          : null;

        // 🛡️ Security Check: Center Manager can only see orders from their center
        if (req.user.role === 'center_manager' && req.user.centerId) {
          if (student && Number(student.centerId) !== Number(req.user.centerId)) {
            continue;
          }
        }


        // بحث بالاسم / رقم الطلب / عنوان المنتج
        if (search) {
          const name =
            (student?.studentName || student?.name || "").toLowerCase();
          const title = (mainItem?.title || "").toLowerCase();
          const idStr = String(order.id);
          const matches =
            name.includes(search) ||
            title.includes(search) ||
            idStr.includes(search);
          if (!matches) continue;
        }

        const mainItemType = mainItem
          ? String(mainItem.itemType || "").toUpperCase()
          : null;
        let mainItemTitle = mainItem ? mainItem.title : null;

        if (!mainItemTitle && mainItemType === "COURSE") {
          const course = await CourseMysql.findByPk(mainItem.itemId);
          if (course) mainItemTitle = course.title;
        } else if (!mainItemTitle && mainItemType === "PLAN") {
          const plan = await PlanMysql.findByPk(mainItem.itemId);
          if (plan) mainItemTitle = plan.name;
        }

        // استنتاج الصورة بطريقة قوية
        const rawP = p.toJSON ? p.toJSON() : p;
        const rawO = order.toJSON ? order.toJSON() : order;
        
        let proofImageUrl =
          rawP.proofImageUrl ||
          rawP.proof_image_url ||
          rawP.screenshotUrl ||
          rawP.screenshot_url ||
          rawP.imageUrl ||
          rawP.image_url ||
          (rawP.meta && typeof rawP.meta === 'object' 
            ? (rawP.meta.proofImageUrl || rawP.meta.screenshotUrl || rawP.meta.imageUrl)
            : null) ||
          rawO.proofImageUrl ||
          rawO.proof_image_url ||
          rawO.screenshotUrl ||
          rawO.screenshot_url ||
          rawO.imageUrl ||
          rawO.image_url ||
          null;

        rows.push({
          id: order.id,
          studentId: order.studentId,
          studentName: student?.studentName || student?.student_name || student?.name || null,
          totalCents: order.totalCents,
          currency: order.currency,
          status: order.status,
          provider: order.provider,
          createdAt: order.createdAt || order.updatedAt,
          payment: {
            id: p.id,
            status: p.status,
            method: p.method,
            provider: p.provider,
            createdAt: p.createdAt,
          },
          items: filteredItems.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            itemId: it.itemId,
            title: it.title,
            priceCents: it.priceCents,
          })),
          mainItemType,
          mainItemTitle,
          proofImageUrl,
        });
      }

      return res.json({
        success: true,
        data: {
          rows,
          total: count,
          page,
          pageSize,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  // --- استعلام صلاحية الدخول لكورس ---
  /**
   * @swagger
   * /checkout/access/course/{id}:
   *   get:
   *     summary: استعلام صلاحية دخول الطالب لكورس معيّن
   *     description: يفحص إن كان الطالب يمتلك صلاحية مشاهدة الكورس عبر شراء أو اشتراك أو باقة.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.get("/access/course/:id", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      const courseId = Number(req.params.id);
      if (!studentId || !courseId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const result = await hasEntitlement({
        models,
        studentId,
        resource: { type: "COURSE", id: courseId },
      });
      return res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  });

  // --- استهلاك كورس من باقة QUOTA ---

  /**
   * @swagger
   * /checkout/subscriptions/claim-course:
   *   post:
   *     summary: استهلاك كورس من باقة QUOTA
   *     description: يستهلك كورس واحد من حصة باقة اشتراك نوعها QUOTA، ويضيف record في SubscriptionConsumption.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/subscriptions/claim-course", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      const courseId = Number(req.body?.courseId);
      if (!studentId || !courseId) {
        return res
          .status(400)
          .json({ success: false, message: "بيانات ناقصة" });
      }

      const course = await CourseMysql.findByPk(courseId);
      if (!course || course.isDeleted) {
        return res
          .status(404)
          .json({ success: false, message: "الكورس غير موجود" });
      }

      const access = await hasEntitlement({
        models,
        studentId,
        resource: { type: "COURSE", id: courseId },
      });

      if (access.ok)
        return res.json({
          success: true,
          message: "لديك وصول بالفعل",
          data: access,
        });

      if (
        access.via !== "subscription_quota_eligible" ||
        access.planKind !== "QUOTA"
      ) {
        return res
          .status(403)
          .json({ success: false, message: "غير مؤهل للاستهلاك من باقة" });
      }

      const subId = access.subscriptionId;
      const planId = access.planId;

      const sub = await SubscriptionMysql.findByPk(subId);
      const plan = await PlanMysql.findByPk(planId);
      if (!sub || !plan || String(plan.kind) !== "QUOTA") {
        return res
          .status(400)
          .json({ success: false, message: "الاشتراك غير صالح للاستهلاك" });
      }

      const now = Date.now();
      const s = sub.startsAt ? new Date(sub.startsAt).getTime() : 0;
      const e = sub.endsAt ? new Date(sub.endsAt).getTime() : 0;
      if (!(s <= now && now <= e)) {
        return res
          .status(400)
          .json({ success: false, message: "الاشتراك غير نشط" });
      }

      const count = await SubscriptionConsumptionMysql.count({
        where: { subscriptionId: sub.id },
      });
      if (count >= (plan.quotaCount || 0)) {
        return res.status(400).json({
          success: false,
          message: "تم استنفاد الحصة لهذه الباقة",
        });
      }

      await SubscriptionConsumptionMysql.create({
        subscriptionId: sub.id,
        courseId,
        consumedAt: new Date(),
      });

      return res.json({
        success: true,
        message: "تم استهلاك الكورس من باقة الحصص",
        data: { subscriptionId: sub.id, courseId },
      });
    } catch (e) {
      next(e);
    }
  });

  // --- اشتراكات الطالب في الباقات (للـ UI) ---

  /**
   * @swagger
   * /checkout/subscriptions/my-plans:
   *   get:
   *     summary: قائمة اشتراكات الطالب في الباقات
   *     description: يرجع جميع الاشتراكات (القديمة والحالية) مع فلاغ activeNow حسب التاريخ والحالة.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.get("/subscriptions/my-plans", requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        return res
          .status(401)
          .json({ success: false, message: "غير مصرح" });
      }

      const subs = await SubscriptionMysql.findAll({
        where: { studentId },
        order: [["startsAt", "DESC"]],
      });

      const now = Date.now();

      const data = subs.map((s) => {
        const startsAt = s.startsAt ? new Date(s.startsAt) : null;
        const endsAt = s.endsAt ? new Date(s.endsAt) : null;

        let activeNow = String(s.status) === "active";
        if (activeNow && startsAt && endsAt) {
          const sm = startsAt.getTime();
          const em = endsAt.getTime();
          activeNow = sm <= now && now <= em;
        }

        return {
          id: s.id,
          planId: s.planId,
          status: s.status,
          startsAt,
          endsAt,
          activeNow,
        };
      });

      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  // ---------------------------------
  // 6) طلبات الدفع اليدوي (للوحة التحكم) - نسخة غير مجمّعة
  // ---------------------------------

  /**
   * @swagger
   * /checkout/manual/manual-orders:
   *   get:
   *     summary: طلبات الدفع اليدوي (مفلترة على مستوى العناصر)
   *     description: يرجع عناصر الطلبات اليدوية بشكل مسطّح (Item-level) مع دعم بحث و分页 مختلف عن /manual/orders.
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   */
  router.get("/manual/manual-orders", requireAuth, requireRole('admin', 'supervisor', 'center_manager'), async (req, res, next) => {
    try {
      const status = String(req.query.status || "pending").toLowerCase();
      const type = String(req.query.type || "ALL").toUpperCase();
      const search = String(req.query.search || "").trim().toLowerCase();

      const page = Math.max(
        parseInt(String(req.query.page ?? "0"), 10) || 0,
        0
      );
      const rawPageSize =
        parseInt(String(req.query.pageSize ?? "20"), 10) || 20;
      const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

      // كل الطلبات اللي Provider = manual (دفع يدوي)
      const orderWhere = { provider: "manual" };

      if (status === "pending") {
        orderWhere.status = "pending";
      } else if (status === "paid") {
        orderWhere.status = "paid";
      }

      const orders = await OrderMysql.findAll({
        where: orderWhere,
        order: [["createdAt", "DESC"]],
      });

      const allItems = [];

      for (const ord of orders) {
        const [orderItems, payment, student] = await Promise.all([
          OrderItemMysql.findAll({ where: { orderId: ord.id } }),
          PaymentMysql.findOne({
            where: { orderId: ord.id },
            order: [["createdAt", "DESC"]],
          }),
          StudentMysql && ord.studentId
            ? StudentMysql.findByPk(ord.studentId)
            : Promise.resolve(null),
        ]);

        for (const oi of orderItems) {
          const itemType = String(oi.itemType || "").toUpperCase();

          // فلتر النوع من الـ query (COURSE / PLAN / ALL)
          if (type !== "ALL" && itemType !== type) continue;

          const dto = {
            id: oi.id,
            orderId: ord.id,
            studentId: ord.studentId,
            student: student
              ? {
                id: student.id,
                name:
                  student.studentName ||
                  student.student_name ||
                  student.name ||
                  [student.firstName, student.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                  null,
                phone: student.studentPhone || student.student_phone || student.phone || null,
                year: student.year || student.stage || null,
              }
              : null,
            itemType,
            itemId: oi.itemId,
            itemTitle: oi.title || "",
            amountCents:
              typeof oi.priceCents === "number"
                ? oi.priceCents
                : ord.totalCents || 0,
            currency: ord.currency || "EGP",
            paymentMethod: payment?.method || payment?.provider || null,
            orderStatus: ord.status || "pending",
            paymentStatus: payment?.status || null,
            createdAt: (
              payment?.createdAt ||
              ord.createdAt ||
              new Date()
            ).toISOString(),
            proofImageUrl:
              payment?.proofImageUrl ||
              payment?.proof_image_url ||
              payment?.screenshotUrl ||
              payment?.screenshot_url ||
              payment?.imageUrl ||
              payment?.image_url ||
              (payment?.meta && typeof payment.meta === 'object' 
                ? (payment.meta.proofImageUrl || payment.meta.screenshotUrl || payment.meta.imageUrl)
                : null) ||
              ord.proofImageUrl ||
              ord.proof_image_url ||
              ord.screenshotUrl ||
              ord.screenshot_url ||
              ord.imageUrl ||
              ord.image_url ||
              null,
          };

          if (dto.proofImageUrl) {
            console.log(`[manual-orders] Found proof for Order #${ord.id}:`, dto.proofImageUrl);
          } else {
            const pKeys = Object.keys(payment?.toJSON() || {});
            const oKeys = Object.keys(ord?.toJSON() || {});
            console.log(`[manual-orders] No proof found for Order #${ord.id}. Payment Keys:`, pKeys, "Order Keys:", oKeys);
          }

          // فلتر الـ search لو موجود
          if (search) {
            const haystack = [
              dto.student?.name,
              dto.student?.phone,
              dto.itemTitle,
              dto.orderId?.toString(),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            if (!haystack.includes(search)) {
              continue;
            }
          }

          allItems.push(dto);
        }
      }

      const total = allItems.length;
      const start = page * pageSize;
      const items = allItems.slice(start, start + pageSize);

      return res.json({
        success: true,
        data: {
          items,
          page,
          pageSize,
          total,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------
  // 4) Admin: Student Enrollments History & Extension
  // ---------------------------------

  /**
   * GET /checkout/admin/students/:studentId/enrollments
   * قائمة بكورسات الطالب وتواريخ الدخول
   */
  router.get("/admin/students/:studentId/enrollments", requireAuth, requireRole('admin', 'supervisor', 'center_manager', 'user'), async (req, res, next) => {
    try {
      const studentId = Number(req.params.studentId);
      if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });

      // 🛡️ Security Check: Center Manager can only see enrollments for their students
      if (req.user.role === 'center_manager' && req.user.centerId) {
        const student = await StudentMysql.findByPk(studentId);
        if (student && Number(student.centerId) !== Number(req.user.centerId)) {
          return res.status(403).json({ success: false, message: "ليس لديك صلاحية لعرض اشتراكات هذا الطالب." });
        }
      }


      const list = await EnrollmentMysql.findAll({
        where: { studentId },
        include: [
          { model: CourseMysql, as: 'course', attributes: ['id', 'title', 'coverImageUrl'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.json({ success: true, data: list });
    } catch (e) {
      next(e);
    }
  });

  /**
   * POST /admin/enrollments/:id/extend
   * تطويل مدة الوصول (days, hours)
   */
  router.post("/admin/enrollments/:id/extend", requireAuth, requireRole('admin', 'supervisor', 'center_manager', 'user'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { days, hours } = req.body;
      
      const enrollment = await EnrollmentMysql.findByPk(id);
      if (!enrollment) return res.status(404).json({ success: false, message: "السجل غير موجود" });

      const now = new Date();
      // لو لسه الصلاحية شغالة، نزود عليها. لو خلصت، نبدأ من دلوقتي.
      let currentEnd = enrollment.endsAt ? new Date(enrollment.endsAt) : now;
      if (currentEnd < now) currentEnd = now;

      const additionalMs = (Number(days) || 0) * 86400000 + (Number(hours) || 0) * 3600000;
      if (additionalMs <= 0) return res.status(400).json({ success: false, message: "يجب تحديد مدة إضافية" });

      enrollment.endsAt = new Date(currentEnd.getTime() + additionalMs);
      enrollment.updatedAtLocal = now;
      await enrollment.save();

      return res.json({ success: true, message: "تمت إطالة مدة الوصول بنجاح", data: enrollment });
    } catch (e) {
      next(e);
    }
  });

  /**
   * POST /admin/enrollments/:id/expire
   * إغلاق الوصول يدوياً (إنهاء الصلاحية الآن)
   */
  router.post("/admin/enrollments/:id/expire", requireAuth, requireRole('admin', 'supervisor', 'center_manager', 'user'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const enrollment = await EnrollmentMysql.findByPk(id);
      if (!enrollment) return res.status(404).json({ success: false, message: "السجل غير موجود" });

      const now = new Date();
      enrollment.endsAt = now;
      enrollment.updatedAtLocal = now;
      await enrollment.save();

      return res.json({ success: true, message: "تم إغلاق الوصول بنجاح", data: enrollment });
    } catch (e) {
      next(e);
    }
  });

  /**
   * POST /admin/students/:studentId/enroll
   * إضافة كورس/محاضرة للطالب يدوياً
   */
  router.post("/admin/students/:studentId/enroll", requireAuth, requireRole('admin', 'supervisor', 'center_manager', 'user'), async (req, res, next) => {
    try {
      const studentId = Number(req.params.studentId);
      const { courseId } = req.body;

      if (!studentId || !courseId) {
        return res.status(400).json({ success: false, message: "studentId و courseId مطلوبان" });
      }

      // حساب تاريخ الانتهاء التلقائي (7 أيام)
      const now = new Date();
      const endsAt = new Date(now.getTime() + 7 * 86400000);

      const [enr, created] = await EnrollmentMysql.upsert({
        studentId,
        courseId,
        startsAt: now,
        endsAt: endsAt,
        status: 'active',
        createdAtLocal: now,
        updatedAtLocal: now
      }, { returning: true });

      return res.json({ 
        success: true, 
        message: created ? "تم إضافة الكورس للطالب بنجاح" : "تم تحديث وصول الطالب للكورس",
        data: enr 
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export default createCheckoutRouter;
