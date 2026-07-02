// src/routes/community.routes.js
import { Router } from "express";
import { Op, literal } from "sequelize";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { isAllowedHost } from "../utils/url-guard.js";
import { requireAuth } from "../middlewares/auth.js";
import softAuth from "../middlewares/soft-auth.js";
import { requireRole } from "../middlewares/roles.js";
import r2Client from "../lib/r2-client.js";
import { assertSafeImage } from "../utils/image-moderation.js";

/**
 * @swagger
 * tags:
 *   - name: Community
 *     description: نظام أسئلة المجتمع بين الطلاب وفريق المنصة (سؤال/جواب + مرفقات)
 *
 * components:
 *   schemas:
 *     CommunityAttachment:
 *       type: object
 *       properties:
 *         kind:
 *           type: string
 *           description: نوع المرفق (image, video, audio, pdf, doc, mp4, hls, external, link)
 *         url:
 *           type: string
 *           format: uri
 *         mime:
 *           type: string
 *           nullable: true
 *         provider:
 *           type: string
 *           nullable: true
 *           description: مزوّد الخدمة (youtube, vimeo, ...)
 *         streamType:
 *           type: string
 *           nullable: true
 *         durationSec:
 *           type: number
 *           nullable: true
 *         thumb:
 *           type: string
 *           nullable: true
 *
 *     CommunityQuestion:
 *       type: object
 *       description: سؤال من طالب في نظام المجتمع
 *       properties:
 *         id:
 *           type: integer
 *         studentId:
 *           type: integer
 *         body:
 *           type: string
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [open, answered, closed]
 *         isDeleted:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CommunityQuestionWithStudent:
 *       allOf:
 *         - $ref: '#/components/schemas/CommunityQuestion'
 *         - type: object
 *           properties:
 *             student:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 studentName:
 *                   type: string
 *                   nullable: true
 *                 email:
 *                   type: string
 *                   nullable: true
 *                 studentPhone:
 *                   type: string
 *                   nullable: true
 *                 year:
 *                   type: string
 *                   nullable: true
 *                 region:
 *                   type: string
 *                   nullable: true
 *                 centerName:
 *                   type: string
 *                   nullable: true
 *                 centerCode:
 *                   type: string
 *                   nullable: true
 *             answersCount:
 *               type: integer
 *             lastAnswerByName:
 *               type: string
 *               nullable: true
 *
 *     CommunityAnswer:
 *       type: object
 *       description: إجابة على سؤال
 *       properties:
 *         id:
 *           type: integer
 *         questionId:
 *           type: integer
 *         responderId:
 *           type: integer
 *         responderRole:
 *           type: string
 *         contentText:
 *           type: string
 *           nullable: true
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommunityAttachment'
 *         isDeleted:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CommunityAnswerWithResponder:
 *       allOf:
 *         - $ref: '#/components/schemas/CommunityAnswer'
 *         - type: object
 *           properties:
 *             responder:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 name:
 *                   type: string
 *                   nullable: true
 *
 *     UploadImageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         url:
 *           type: string
 *           format: uri
 *         fileName:
 *           type: string
 *         mime:
 *           type: string
 *         size:
 *           type: integer
 *
 *     CreateCommunityQuestionInput:
 *       type: object
 *       required:
 *         - body
 *       properties:
 *         body:
 *           type: string
 *           description: نص السؤال
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           description: رابط صورة السؤال (بعد الرفع من /community/upload)
 *
 *     ListCommunityQuestionsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommunityQuestionWithStudent'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *
 *     AddCommunityAnswerInput:
 *       type: object
 *       properties:
 *         contentText:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommunityAttachment'
 *
 *     UpdateCommunityQuestionStatusInput:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [open, answered, closed]
 */

// هنحتاج __dirname لأننا شغالين ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// اختيار الـ driver (local أو r2)
const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";

// base URL للملفات (للـ local driver فقط)
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "http://localhost:3000";

// إعدادات R2
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

// الحد الأقصى لحجم ملف المجتمع (ميجا) – configurable من env
const MAX_UPLOAD_MB = Number(process.env.COMMUNITY_MAX_UPLOAD_MB || 10);

// فولدر هنخزن فيه الملفات المرفوعة لو شغالين local
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (STORAGE_DRIVER === "local" && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// أنواع المرفقات المسموحة في الإجابات
const ALLOWED_KINDS = [
  "image",
  "video",
  "audio",
  "pdf",
  "doc",
  "mp4",
  "hls",
  "external",
  "link",
];

// ================================
// فلترة الكلمات الممنوعة في المجتمع
// ================================

// من ENV: COMMUNITY_BLOCKED_WORDS=word1,word2,word3
const BLOCKED_WORDS_RAW = process.env.COMMUNITY_BLOCKED_WORDS || "";

// fallback ثابت داخل الكود (عدّل القائمة كما تريد)
const BLOCKED_WORDS_FALLBACK = [
  // "badword1",
  // "badword2",
];

// دمج ونظافة
const BLOCKED_WORDS = Array.from(
  new Set(
    [...BLOCKED_WORDS_RAW.split(","), ...BLOCKED_WORDS_FALLBACK]
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
  )
);

/**
 * فلترة بسيطة: نعمل lowercase ونشوف لو أي كلمة من BLOCKED_WORDS موجودة
 */
function containsBlockedWord(text) {
  if (!text || !BLOCKED_WORDS.length) return null;
  const normalized = String(text).toLowerCase();

  for (const w of BLOCKED_WORDS) {
    if (!w) continue;
    if (normalized.includes(w)) {
      return w; // أول كلمة ممنوعة
    }
  }

  return null;
}

function normalizeAttachments(arr) {
  if (!arr) return null;
  if (!Array.isArray(arr)) return null;

  const out = [];

  for (const x of arr) {
    if (!x || typeof x !== "object") continue;

    const kind = String(x.kind || "").toLowerCase();
    if (!ALLOWED_KINDS.includes(kind)) continue;

    const url = String(x.url || "").trim();
    if (!url) continue;

    const provider = String(x.provider || "").toLowerCase();

    const isExternal =
      kind === "external" || ["youtube", "vimeo"].includes(provider);

    const isR2Url =
      R2_PUBLIC_BASE_URL && url.startsWith(R2_PUBLIC_BASE_URL);

    // لو مش external ومش R2 URL، لازم يكون من دومين مسموح به
    if (!isExternal && !isR2Url && !isAllowedHost(url)) continue;

    out.push({
      kind,
      url,
      mime: x.mime ?? null,
      provider: x.provider ? provider : null,
      streamType: x.streamType ? String(x.streamType).toLowerCase() : null,
      durationSec:
        x.durationSec != null ? Number(x.durationSec) : null,
      thumb: x.thumb ?? null,
    });
  }

  return out.length ? out : null;
}

/* ---------------------------------
   Multer (رفع الصور / الفيديوهات)
---------------------------------- */

function mediaFileFilter(_req, file, cb) {
  // نسمح بالصور والفيديوهات فقط في هذا المسار
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    return cb(null, true);
  }
  return cb(new Error("Only image/* and video/* files are allowed"));
}

// نستخدم memoryStorage عشان نرفع على R2 أو نكتب محلي حسب الـ driver
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024, // بالبايت
  },
});

// Helpers لتوليد اسم ملف وتخمين الامتداد/النوع

function generateRandomId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function guessExtension(originalName, mimeType) {
  const extFromName = path
    .extname(originalName || "")
    .toLowerCase()
    .replace(/[^.\w]/g, "");

  if (extFromName) return extFromName;

  if (!mimeType) return ".bin";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "video/mp4") return ".mp4";

  return ".bin";
}

function detectKindFromMime(mimeType) {
  if (!mimeType) return "doc";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  return "doc";
}

// دالة موحّدة لتخزين الملف في R2 أو على السيرفر مع ضغط الصور
async function persistCommunityFile({ file, userId }) {
  const { buffer, mimetype, originalname, size } = file;

  const safeUserId = userId || "unknown";

  let finalBuffer = buffer;
  let finalMime = mimetype;
  let finalExt = guessExtension(originalname, mimetype);
  const originalSize = size;

  const kind = detectKindFromMime(mimetype);

  // ضغط الصور إلى WebP بجودة 80
  if (mimetype && mimetype.startsWith("image/")) {
    try {
      const compressed = await sharp(buffer)
        .rotate()
        .webp({ quality: 80 })
        .toBuffer();
      finalBuffer = compressed;
      finalMime = "image/webp";
      finalExt = ".webp";
    } catch (err) {
      console.error("image compression failed:", err);
      // في حالة الفشل نكمل بالـ buffer الأصلي
    }
  }

  const uniquePart = Date.now() + "-" + generateRandomId().slice(0, 8);
  const storedFileName = `${uniquePart}${finalExt}`;

  // 1) التخزين على Cloudflare R2
  if (STORAGE_DRIVER === "r2") {
    if (!r2Client) {
      throw new Error(
        "R2 client is not configured. تأكد من إعدادات R2 و STORAGE_DRIVER=r2"
      );
    }
    if (!R2_BUCKET) {
      throw new Error("R2_BUCKET is required when STORAGE_DRIVER=r2");
    }
    if (!R2_PUBLIC_BASE_URL) {
      throw new Error(
        "R2_PUBLIC_BASE_URL is required when STORAGE_DRIVER=r2"
      );
    }

    const key = `community/${safeUserId}/${storedFileName}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: finalBuffer,
        ContentType: finalMime || "application/octet-stream",
      })
    );

    const url = `${R2_PUBLIC_BASE_URL}/${key}`;

    return {
      url,
      key,
      kind,
      fileName: originalname,
      mime: finalMime,
      size: finalBuffer.length,
      originalSize,
      driver: "r2",
    };
  }

  // 2) التخزين Local على السيرفر (public/uploads)
  const studentFolder = path.join(
    uploadsDir,
    "community",
    String(safeUserId)
  );
  await fs.promises.mkdir(studentFolder, { recursive: true });

  const filePath = path.join(studentFolder, storedFileName);
  await fs.promises.writeFile(filePath, finalBuffer);

  const relativePath = `community/${safeUserId}/${storedFileName}`;
  const url = `${PUBLIC_BASE_URL}/uploads/${relativePath}`;

  return {
    url,
    key: relativePath,
    kind,
    fileName: originalname,
    mime: finalMime,
    size: finalBuffer.length,
    originalSize,
    driver: "local",
  };
}

/* ---------------------------------
   الراوتر الرئيسي
---------------------------------- */

export default function createCommunityRouter(models) {
  const router = Router();

  const modelsSafe = models || {};

  const {
    CommunityQuestionMysql,
    CommunityQuestion,
    CommunityAnswerMysql,
    CommunityAnswer,
    StudentMysql,
    Student,
    UserMysql,
    User,
  } = modelsSafe;

  // موديلات موحّدة تدعم كل التسميات المحتملة
  const CommunityQuestionModel =
    CommunityQuestionMysql ||
    CommunityQuestion ||
    modelsSafe.CommunityQuestionMysql ||
    modelsSafe.CommunityQuestion ||
    null;

  const CommunityAnswerModel =
    CommunityAnswerMysql ||
    CommunityAnswer ||
    modelsSafe.CommunityAnswerMysql ||
    modelsSafe.CommunityAnswer ||
    null;

  const StudentModel =
    StudentMysql ||
    Student ||
    modelsSafe.StudentMysql ||
    modelsSafe.Student ||
    null;

  const UserModel =
    UserMysql ||
    User ||
    modelsSafe.UserMysql ||
    modelsSafe.User ||
    null;

  if (!CommunityQuestionModel) {
    throw new Error(
      "CommunityQuestion model (CommunityQuestion / CommunityQuestionMysql) is not configured"
    );
  }
  if (!CommunityAnswerModel) {
    throw new Error(
      "CommunityAnswer model (CommunityAnswer / CommunityAnswerMysql) is not configured"
    );
  }
  if (!StudentModel) {
    throw new Error(
      "Student model (Student / StudentMysql) is not configured"
    );
  }
  if (!UserModel) {
    throw new Error(
      "User model (User / UserMysql) is not configured"
    );
  }

  /* ================================
     1. رفع صورة/فيديو سؤال (طالب)
     form-data: image: (image/video)
  ================================= */

  // ميدل وير single upload مع اسم الحقل image (زي الفرونت)
  const communitySingleUpload = uploadMedia.single("image");

  /**
   * @swagger
   * /community/upload:
   *   post:
   *     summary: رفع صورة أو فيديو لسؤال المجتمع (طالب)
   *     description: يرفع ملف (صورة أو فيديو) لسؤال المجتمع ويعيد رابط الملف بعد التخزين على R2 أو السيرفر المحلي.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               image:
   *                 type: string
   *                 format: binary
   *                 description: ملف صورة أو فيديو
   *     responses:
   *       200:
   *         description: تم رفع الملف بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UploadImageResponse'
   *       400:
   *         description: خطأ في البيانات أو حجم الملف أكبر من المسموح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 code:
   *                   type: string
   *                   nullable: true
   *       500:
   *         description: خطأ في السيرفر أو فشل في الفحص/الحفظ
   */
  router.post("/upload", requireAuth, (req, res) => {
    communitySingleUpload(req, res, async (err) => {
      // 1) أخطاء Multer (حجم أكبر من limit، إلخ)
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: `حجم الملف كبير. الحد الأقصى المسموح هو ${MAX_UPLOAD_MB} ميجا.`,
            code: "FILE_TOO_LARGE",
          });
        }

        return res.status(400).json({
          success: false,
          message: `خطأ في رفع الملف (${err.code})`,
          code: err.code,
        });
      }

      // 2) أخطاء عادية
      if (err) {
        console.error("upload error:", err);
        return res.status(500).json({
          success: false,
          message: "حدث خطأ أثناء رفع الملف",
        });
      }

      // 3) لو مفيش ملف
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "لم يتم استلام أي ملف",
        });
      }

      // ✅ 3.1 فحص محتوى الصورة (لو الملف صورة) باستخدام Google Vision عبر assertSafeImage
      const { mimetype, buffer } = req.file;
      if (mimetype && mimetype.startsWith("image/")) {
        try {
          const isSafe = await assertSafeImage(buffer);

          if (!isSafe) {
            // مرفوض: صورة غير مناسبة/إباحية
            return res.status(400).json({
              success: false,
              message:
                "الصورة غير مناسبة لبيئة تعليمية محترمة. من فضلك اختر صورة مختلفة.",
              code: "IMAGE_NOT_ALLOWED",
            });
          }
        } catch (modErr) {
          console.error("image moderation error:", modErr);
          // حذر: نمنع الصورة لو خدمة الفحص وقعت
          return res.status(500).json({
            success: false,
            message:
              "تعذر التحقق من محتوى الصورة في الوقت الحالي. حاول مرة أخرى لاحقًا.",
            code: "IMAGE_MODERATION_FAILED",
          });
        }
      }

      // 4) الحالة الطبيعية – تخزين الملف في R2 أو local
      try {
        const stored = await persistCommunityFile({
          file: req.file,
          userId: req.user?.id,
        });

        return res.json({
          success: true,
          url: stored.url,
          fileName: stored.fileName,
          mime: stored.mime,
          size: stored.size,
          originalSize: stored.originalSize,
          key: stored.key,
          kind: stored.kind,
          driver: stored.driver,
        });
      } catch (e) {
        console.error("upload persist error:", e);
        return res.status(500).json({
          success: false,
          message: "فشل حفظ الملف على التخزين",
        });
      }
    });
  });

  /* ================================
     2. إنشاء سؤال (طالب)
  ================================= */

  /**
   * @swagger
   * /community/questions:
   *   post:
   *     summary: إنشاء سؤال جديد في المجتمع (طالب)
   *     description: يسمح للطالب بإنشاء سؤال جديد في نظام المجتمع مع نص السؤال وصورة اختيارية.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCommunityQuestionInput'
   *     responses:
   *       200:
   *         description: تم إنشاء السؤال بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CommunityQuestion'
   *       400:
   *         description: خطأ في البيانات أو نص قصير جدًا أو كلمات ممنوعة
   *       403:
   *         description: هذا المسار للطلاب فقط
   */
  router.post("/questions", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "هذا المسار للطلاب فقط" });
      }

      const body = String(req.body?.body || "").trim();
      const imageUrl = req.body?.imageUrl
        ? String(req.body.imageUrl).trim()
        : null;

      if (!body || body.length < 3) {
        return res.status(400).json({
          success: false,
          message: "محتوى السؤال (نص) مطلوب بحد أدنى 3 أحرف",
        });
      }

      // فلترة الكلمات الممنوعة في نص السؤال
      const badWord = containsBlockedWord(body);
      if (badWord) {
        return res.status(400).json({
          success: false,
          message:
            "نص السؤال يحتوي على كلمات غير مسموح بها. من فضلك عدّل الصياغة بأسلوب مناسب.",
          code: "FORBIDDEN_WORD",
        });
      }

      if (imageUrl) {
        const isR2Url =
          R2_PUBLIC_BASE_URL && imageUrl.startsWith(R2_PUBLIC_BASE_URL);

        if (!isR2Url && !isAllowedHost(imageUrl)) {
          return res.status(400).json({
            success: false,
            message: "دومين الصورة غير مسموح",
          });
        }
      }

      const data = {
        studentId: Number(req.user.id),
        body,
        imageUrl,
        status: "open",
        updatedAtLocal: new Date(),
      };

      const created = await CommunityQuestionModel.create(data);

      res.json({ success: true, data: created.toJSON() });
    } catch (e) {
      next(e);
    }
  });

  /* ================================
     3. لستة الأسئلة
  ================================= */

  /**
   * @swagger
   * /community/questions:
   *   get:
   *     summary: استرجاع قائمة أسئلة المجتمع
   *     description: يرجع قائمة بالأسئلة مع بيانات الطالب وعدد الإجابات وآخر من رد، مع دعم البحث والترشيح والصفحات.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: بحث بالنص داخل السؤال
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [open, answered, closed]
   *         description: فلترة حسب حالة السؤال
   *       - in: query
   *         name: mine
   *         schema:
   *           type: string
   *           enum: ["0", "1"]
   *         description: لو 1 والـ user طالب، يرجع أسئلة هذا الطالب فقط
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: رقم الصفحة (لو all != 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: عدد العناصر في الصفحة
   *       - in: query
   *         name: all
   *         schema:
   *           type: string
   *           enum: ["0", "1"]
   *         description: لو 1 يرجع كل الأسئلة بدون صفحات (مع استخدام endpoint منفصل أيضًا /community/questions/all)
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ListCommunityQuestionsResponse'
   */
  router.get("/questions", softAuth, async (req, res, next) => {
    try {
      const q = String(req.query.q || "").trim();
      const status = String(req.query.status || "").trim();
      const mine = String(req.query.mine || "").trim() === "1";
      const all = String(req.query.all || "").trim() === "1";

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = all
        ? undefined
        : Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const offset = all ? undefined : (page - 1) * limit;

      const where = { isDeleted: false };
      if (q) where.body = { [Op.like]: `%${q}%` };
      if (status) where.status = status;
      if (mine && req.user?.role === "student") {
        where.studentId = Number(req.user.id);
      }

      const findOpts = {
        where,
        order: [["id", "DESC"]],
        include: [
          {
            model: StudentModel,
            as: "student",
            attributes: [
              "id",
              "studentName",
              "email",
              "studentPhone",
              "year",
              "region",
              "centerName",
              "centerCode",
            ],
          },
        ],
        attributes: {
          include: [
            [
              literal(
                `(SELECT COUNT(1)
                    FROM community_answers a
                   WHERE a.questionId = CommunityQuestion.id
                     AND a.isDeleted = 0)`
              ),
              "answersCount",
            ],
            [
              literal(
                `(SELECT COALESCE(u.name, u.email)
                    FROM community_answers a
                    JOIN users u ON u.id = a.responderId
                   WHERE a.questionId = CommunityQuestion.id
                     AND a.isDeleted = 0
                   ORDER BY a.id DESC
                   LIMIT 1)`
              ),
              "lastAnswerByName",
            ],
          ],
        },
      };

      if (!all) {
        findOpts.limit = limit;
        findOpts.offset = offset;
      }

      const { rows, count } =
        await CommunityQuestionModel.findAndCountAll(findOpts);

      return res.json({
        success: true,
        data: rows,
        pagination: all
          ? { total: count }
          : { page, limit, total: count },
      });
    } catch (e) {
      next(e);
    }
  });

  /* ================================
     4. كل الأسئلة مرة واحدة
  ================================= */

  /**
   * @swagger
   * /community/questions/all:
   *   get:
   *     summary: استرجاع جميع أسئلة المجتمع دفعة واحدة
   *     description: يرجع كل الأسئلة غير المحذوفة في المجتمع مع بيانات الطلاب وعدد الإجابات وآخر من رد.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: جميع الأسئلة
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
   *                     $ref: '#/components/schemas/CommunityQuestionWithStudent'
   *                 total:
   *                   type: integer
   */
  router.get("/questions/all", softAuth, async (_req, res, next) => {
    try {
      const rows = await CommunityQuestionModel.findAll({
        where: { isDeleted: false },
        order: [["id", "DESC"]],
        include: [
          {
            model: StudentModel,
            as: "student",
            attributes: [
              "id",
              "studentName",
              "email",
              "studentPhone",
              "year",
              "region",
              "centerName",
              "centerCode",
            ],
          },
        ],
        attributes: {
          include: [
            [
              literal(
                `(SELECT COUNT(1)
                    FROM community_answers a
                   WHERE a.questionId = CommunityQuestion.id
                     AND a.isDeleted = 0)`
              ),
              "answersCount",
            ],
            [
              literal(
                `(SELECT COALESCE(u.name, u.email)
                    FROM community_answers a
                    JOIN users u ON u.id = a.responderId
                   WHERE a.questionId = CommunityQuestion.id
                     AND a.isDeleted = 0
                   ORDER BY a.id DESC
                   LIMIT 1)`
              ),
              "lastAnswerByName",
            ],
          ],
        },
      });

      return res.json({
        success: true,
        data: rows,
        total: rows.length,
      });
    } catch (e) {
      next(e);
    }
  });

  /* ================================
     5. تفاصيل سؤال + الردود
  ================================= */

  /**
   * @swagger
   * /community/questions/{id}:
   *   get:
   *     summary: تفاصيل سؤال واحد مع الردود
   *     description: يرجع بيانات السؤال مع بيانات الطالب وجميع الردود عليه مع بيانات المجيب.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال
   *     responses:
   *       200:
   *         description: تفاصيل السؤال والردود
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
   *                     question:
   *                       $ref: '#/components/schemas/CommunityQuestionWithStudent'
   *                     answers:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/CommunityAnswerWithResponder'
   *       400:
   *         description: معرّف غير صالح
   *       404:
   *         description: السؤال غير موجود
   */
  router.get("/questions/:id", softAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "معرّف غير صالح" });
      }

      const q = await CommunityQuestionModel.findOne({
        where: { id, isDeleted: false },
        include: [
          {
            model: StudentModel,
            as: "student",
            attributes: [
              "id",
              "studentName",
              "email",
              "studentPhone",
              "year",
              "region",
              "centerName",
              "centerCode",
            ],
          },
        ],
      });

      if (!q) {
        return res.status(404).json({
          success: false,
          message: "السؤال غير موجود",
        });
      }

      const answers = await CommunityAnswerModel.findAll({
        where: { questionId: id, isDeleted: false },
        order: [["id", "ASC"]],
        include: [
          {
            model: UserModel,
            as: "responder",
            attributes: ["id", "email", "role", "name"],
          },
        ],
      });

      res.json({
        success: true,
        data: { question: q, answers },
      });
    } catch (e) {
      next(e);
    }
  });

  /* ================================
     6. إضافة إجابة
  ================================= */

  /**
   * @swagger
   * /community/questions/{id}/answers:
   *   post:
   *     summary: إضافة إجابة على سؤال
   *     description: يسمح لأعضاء فريق المنصة (roles = user, admin) بإضافة إجابة نصية أو وسائط على سؤال طالب.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AddCommunityAnswerInput'
   *     responses:
   *       200:
   *         description: تم إضافة الإجابة بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/CommunityAnswerWithResponder'
   *       400:
   *         description: معرّف غير صالح أو لا يوجد نص/مرفقات أو كلمات ممنوعة
   *       403:
   *         description: صلاحيات غير كافية (الطالب لا يحق له الرد هنا)
   *       404:
   *         description: السؤال غير موجود
   */
  router.post(
    "/questions/:id/answers",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "معرّف غير صالح" });
        }

        const q = await CommunityQuestionModel.findOne({
          where: { id, isDeleted: false },
        });
        if (!q) {
          return res.status(404).json({
            success: false,
            message: "السؤال غير موجود",
          });
        }

        const contentText = String(req.body?.contentText || "").trim();
        const attachments = normalizeAttachments(req.body?.attachments);

        if (!contentText && !attachments) {
          return res.status(400).json({
            success: false,
            message: "أرسل نصًا أو وسائط واحدة على الأقل",
          });
        }

        // فلترة الكلمات الممنوعة في نص الإجابة
        if (contentText) {
          const badWord = containsBlockedWord(contentText);
          if (badWord) {
            return res.status(400).json({
              success: false,
              message:
                "نص الإجابة يحتوي على كلمات غير مسموح بها. من فضلك عدّل الرد بأسلوب مناسب.",
              code: "FORBIDDEN_WORD",
            });
          }
        }

        const created = await CommunityAnswerModel.create({
          questionId: id,
          responderId: Number(req.user.id),
          responderRole: req.user.role || "user",
          contentText: contentText || null,
          attachments,
          updatedAtLocal: new Date(),
        });

        if (q.status === "open") {
          await CommunityQuestionModel.update(
            {
              status: "answered",
              updatedAtLocal: new Date(),
            },
            { where: { id } }
          );
        }

        const withResponder = await CommunityAnswerModel.findByPk(
          created.id,
          {
            include: [
              {
                model: UserModel,
                as: "responder",
                attributes: ["id", "email", "role", "name"],
              },
            ],
          }
        );

        res.json({ success: true, data: withResponder });
      } catch (e) {
        next(e);
      }
    }
  );

  /* ================================
     7. تغيير حالة السؤال
  ================================= */

  /**
   * @swagger
   * /community/questions/{id}/status:
   *   patch:
   *     summary: تحديث حالة سؤال
   *     description: يغيّر حالة السؤال (open, answered, closed). مخصص للإدمن.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCommunityQuestionStatusInput'
   *     responses:
   *       200:
   *         description: تم تحديث حالة السؤال
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                     status:
   *                       type: string
   *       400:
   *         description: بيانات غير صالحة
   *       403:
   *         description: صلاحيات غير كافية (يتطلب admin)
   *       404:
   *         description: السؤال غير موجود
   */
  router.patch(
    "/questions/:id/status",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const nextStatus = String(req.body?.status || "").trim();

        if (!id || !["open", "answered", "closed"].includes(nextStatus)) {
          return res.status(400).json({
            success: false,
            message: "بيانات غير صالحة",
          });
        }

        const q = await CommunityQuestionModel.findOne({
          where: { id, isDeleted: false },
        });
        if (!q) {
          return res.status(404).json({
            success: false,
            message: "السؤال غير موجود",
          });
        }

        await CommunityQuestionModel.update(
          {
            status: nextStatus,
            updatedAtLocal: new Date(),
          },
          { where: { id } }
        );

        res.json({
          success: true,
          message: "تم التحديث",
          data: { id, status: nextStatus },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /* ================================
     8) حذف سؤال واحد + ردوده (soft)
  ================================= */

  /**
   * @swagger
   * /community/questions/{id}:
   *   delete:
   *     summary: حذف سؤال واحد وكل ردوده (soft delete)
   *     description: يحذف سؤال واحد (isDeleted = true) مع جميع الردود المرتبطة به. مخصص للإدمن.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: رقم السؤال
   *     responses:
   *       200:
   *         description: تم حذف السؤال والردود
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                     answersDeleted:
   *                       type: integer
   *       400:
   *         description: معرّف غير صالح
   *       403:
   *         description: صلاحيات غير كافية
   *       404:
   *         description: السؤال غير موجود
   */
  router.delete(
    "/questions/:id",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "معرّف غير صالح" });
        }

        const q = await CommunityQuestionModel.findOne({
          where: { id, isDeleted: false },
          attributes: ["id"],
        });
        if (!q) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        await CommunityQuestionModel.update(
          { isDeleted: true, updatedAtLocal: new Date() },
          { where: { id } }
        );

        const answers = await CommunityAnswerModel.findAll({
          where: { questionId: id, isDeleted: false },
          attributes: ["id"],
        });

        if (answers.length) {
          const answerIds = answers.map((a) => a.id);
          await CommunityAnswerModel.update(
            { isDeleted: true, updatedAtLocal: new Date() },
            { where: { id: answerIds } }
          );
        }

        return res.json({
          success: true,
          message: "تم حذف السؤال وجميع ردوده",
          data: { id, answersDeleted: answers.length },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /* ================================
     9) حذف مجموعة/كل الأسئلة (soft)
  ================================= */

  /**
   * @swagger
   * /community/questions:
   *   delete:
   *     summary: حذف مجموعة من الأسئلة أو كل الأسئلة (soft delete)
   *     description: يحذف مجموعة من الأسئلة حسب IDs أو يحذف كل الأسئلة دفعة واحدة (مع كل الردود المرتبطة). مخصص للإدمن.
   *     tags: [Community]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: all
   *         schema:
   *           type: string
   *           enum: ["0", "1"]
   *         description: لو 1 يتم حذف كل الأسئلة (isDeleted = true) وتجاهل body.ids
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               ids:
   *                 type: array
   *                 description: قائمة IDs للأسئلة المطلوب حذفها (تستخدم إذا all != 1)
   *                 items:
   *                   type: integer
   *     responses:
   *       200:
   *         description: نتيجة عملية الحذف
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     questions:
   *                       type: integer
   *                     answers:
   *                       type: integer
   *                     ids:
   *                       type: array
   *                       items:
   *                         type: integer
   *       400:
   *         description: لم يتم إرسال ids ولم يتم استخدام all=1
   *       403:
   *         description: صلاحيات غير كافية
   */
  router.delete(
    "/questions",
    requireAuth,
    requireRole("admin", "user"),
    async (req, res, next) => {
      try {
        const all = String(req.query.all || "") === "1";
        const ids = Array.isArray(req.body?.ids)
          ? req.body.ids.map((n) => Number(n)).filter(Boolean)
          : [];

        if (!all && ids.length === 0) {
          return res.status(400).json({
            success: false,
            message: "أرسل ids كـ Array أو استخدم all=1",
          });
        }

        let targetIds = [];
        if (all) {
          const rows = await CommunityQuestionModel.findAll({
            where: { isDeleted: false },
            attributes: ["id"],
          });
          targetIds = rows.map((r) => r.id);
        } else {
          const rows = await CommunityQuestionModel.findAll({
            where: { id: ids, isDeleted: false },
            attributes: ["id"],
          });
          targetIds = rows.map((r) => r.id);
        }

        if (targetIds.length === 0) {
          return res.json({
            success: true,
            message: "لا توجد أسئلة مطابقة للحذف",
            data: { questions: 0, answers: 0, ids: [] },
          });
        }

        let deletedQ = 0;
        let deletedA = 0;

        for (const qid of targetIds) {
          await CommunityQuestionModel.update(
            { isDeleted: true, updatedAtLocal: new Date() },
            { where: { id: qid } }
          );
          deletedQ++;

          const answers = await CommunityAnswerModel.findAll({
            where: { questionId: qid, isDeleted: false },
            attributes: ["id"],
          });

          if (answers.length) {
            const answerIds = answers.map((a) => a.id);
            await CommunityAnswerModel.update(
              { isDeleted: true, updatedAtLocal: new Date() },
              { where: { id: answerIds } }
            );
            deletedA += answers.length;
          }
        }

        return res.json({
          success: true,
          message: "تم الحذف بنجاح",
          data: { questions: deletedQ, answers: deletedA, ids: targetIds },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}

