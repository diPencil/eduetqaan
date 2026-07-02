// src/routes/students.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";

import "dotenv/config";

import { performOperation } from "../services/replicator.js";
import { sendOtpEmail } from "../services/email.js";
import {
  generateNumericOtp,
  sha256 as sha256Otp,
  minutesFromNow,
} from "../utils/otp.js";

import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { normalizeLevel } from "../utils/levels.js";

/**
 * @swagger
 * tags:
 *   name: Students
 *   description: تسجيل الطلاب، إدارة الحساب والجلسات (Auth) وبيانات الطالب
 *
 * components:
 *   schemas:
 *     StudentSafe:
 *       type: object
 *       description: بيانات الطالب كما تُعاد في الـ API بدون passwordHash.
 *       properties:
 *         id:
 *           type: integer
 *         studentName:
 *           type: string
 *         email:
 *           type: string
 *         studentPhone:
 *           type: string
 *         guardianPhone:
 *           type: string
 *         year:
 *           type: string
 *           description: السنة الدراسية (normalised level).
 *         region:
 *           type: string
 *         centerId:
 *           type: integer
 *           nullable: true
 *         centerName:
 *           type: string
 *           nullable: true
 *         centerCode:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAtLocal:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     StudentRegisterRequest:
 *       type: object
 *       required:
 *         - studentName
 *         - email
 *         - studentPhone
 *         - guardianPhone
 *         - year
 *         - region
 *         - password
 *       properties:
 *         studentName:
 *           type: string
 *           description: اسم الطالب (≥ 3 أحرف).
 *         email:
 *           type: string
 *           format: email
 *         studentPhone:
 *           type: string
 *           description: "رقم يبدأ بـ 01 ويتبعه 9 أرقام."
 *           example: "01012345678"
 *         guardianPhone:
 *           type: string
 *           description: "رقم يبدأ بـ 01 ويتبعه 9 أرقام."
 *         year:
 *           type: string
 *           description: السنة الدراسية (قبل التطبيع).
 *         region:
 *           type: string
 *           description: المحافظة.
 *         centerId:
 *           type: integer
 *           nullable: true
 *           description: سنتر الطالب (اختياري).
 *         centerName:
 *           type: string
 *           nullable: true
 *           description: اسم السنتر الحر (لو مش مختار من الليست).
 *         centerCode:
 *           type: string
 *           nullable: true
 *           description: كود الطالب داخل السنتر (يجب أن يكون فريدًا).
 *         password:
 *           type: string
 *           format: password
 *         confirmPassword:
 *           type: string
 *           format: password
 *
 *     StudentRegisterResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           allOf:
 *             - $ref: '#/components/schemas/StudentSafe'
 *             - type: object
 *               properties:
 *                 level:
 *                   type: string
 *                   description: Normalized level.
 *         accessToken:
 *           type: string
 *
 *     StudentLoginRequest:
 *       type: object
 *       required:
 *         - login
 *         - password
 *       properties:
 *         login:
 *           type: string
 *           description: البريد الإلكتروني أو رقم الطالب.
 *         password:
 *           type: string
 *           format: password
 *         deviceId:
 *           type: string
 *           description: معرّف الجهاز (يمكن إرساله في body أو في الهيدر x-device-id).
 *
 *     StudentLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             studentName:
 *               type: string
 *             email:
 *               type: string
 *             level:
 *               type: string
 *             deviceId:
 *               type: string
 *             centerId:
 *               type: integer
 *               nullable: true
 *             centerName:
 *               type: string
 *               nullable: true
 *             centerCode:
 *               type: string
 *               nullable: true
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *           nullable: true
 *           description: يعاد في الـ body فقط إذا لم نستخدم الكوكي (REFRESH_IN_COOKIE=false).
 *
 *     StudentRefreshRequest:
 *       type: object
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: في حالة عدم استخدام الكوكي، يتم إرسال التوكن هنا.
 *         deviceId:
 *           type: string
 *           description: معرّف الجهاز المستخدم في إنشاء الجلسة.
 *
 *     StudentRefreshResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *           nullable: true
 *
 *     StudentForgotRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *
 *     StudentResetPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *         - otp
 *         - newPassword
 *         - confirmNewPassword
 *       properties:
 *         email:
 *           type: string
 *         otp:
 *           type: string
 *           description: كود التحقق المرسل على الإيميل.
 *         newPassword:
 *           type: string
 *           format: password
 *         confirmNewPassword:
 *           type: string
 *           format: password
 *
 *     StudentChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *         - confirmNewPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *         confirmNewPassword:
 *           type: string
 *
 *     StudentUpdateMeRequest:
 *       type: object
 *       description: كل الحقول اختيارية، يتم تعديل المرسل فقط.
 *       properties:
 *         studentName:
 *           type: string
 *         email:
 *           type: string
 *         studentPhone:
 *           type: string
 *         guardianPhone:
 *           type: string
 *         region:
 *           type: string
 *
 *     StudentUpdateCenterRequest:
 *       type: object
 *       properties:
 *         centerId:
 *           type: integer
 *           nullable: true
 *         centerName:
 *           type: string
 *           nullable: true
 *         centerCode:
 *           type: string
 *           nullable: true
 */

const phoneRegex = /^01\d{9}$/;

const MAX_DEVICES = Number(process.env.MAX_DEVICES || 1);
const ACCESS_EXPIRES = process.env.JWT_AT_EXPIRES || "15m";
const REFRESH_DAYS = Number(process.env.REFRESH_DAYS || 45);
const REFRESH_IN_COOKIE =
  String(process.env.REFRESH_IN_COOKIE || "true").toLowerCase() === "true";

function validateBody(b) {
  const errors = [];
  if (!b.studentName || String(b.studentName).trim().length < 3)
    errors.push("الاسم مطلوب وبحد أدنى 3 أحرف");
  if (!b.email) errors.push("البريد الإلكتروني مطلوب");
  if (!b.studentPhone || !phoneRegex.test(b.studentPhone))
    errors.push("رقم الطالب غير صالح (01 + 9 أرقام)");
  if (!b.guardianPhone || !phoneRegex.test(b.guardianPhone))
    errors.push("رقم ولي الأمر غير صالح (01 + 9 أرقام)");
  if (b.studentPhone && b.guardianPhone && b.studentPhone === b.guardianPhone)
    errors.push("يجب أن يكون رقم الطالب مختلفاً عن رقم ولي الأمر");
  if (!b.year) errors.push("السنة الدراسية مطلوبة");
  if (!b.region) errors.push("المحافظة مطلوبة");
  if (!b.password || String(b.password).length < 4)
    errors.push("كلمة السر مطلوبة وبحد أدنى 4 أحرف");
  if (b.confirmPassword !== undefined && b.confirmPassword !== b.password)
    errors.push("كلمتا السر غير متطابقتين");
  return errors;
}

// console.log("JWT_AT_EXPIRES =", process.env.JWT_AT_EXPIRES);

function issueAccessToken(payload) {
  const secret = process.env.JWT_SECRET || "dev_secret";
  return jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}
function refreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}
function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}
function setRefreshCookie(res, token) {
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";

  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/v1/students",
    maxAge: 1000 * 60 * 60 * 24 * REFRESH_DAYS,
  });
}

function safeStudent(s) {
  const j = typeof s?.toJSON === "function" ? s.toJSON() : s || {};
  const { passwordHash, ...rest } = j;
  return rest;
}

export function createStudentsRouter(models) {
  const router = Router();
const requireStaff = [requireAuth, requireRole("admin", "supervisor", "center_manager", "support")];

  // ندعم الاسم القديم والجديد معًا
  const {
    StudentMysql,
    Student,
    PasswordResetMysql,
    PasswordReset,
    DeviceSessionMysql,
    DeviceSession,
    CenterMysql,
    Center,
    StudentAttendanceMysql,
    StudentAttendance,
    StudentLessonOverrideMysql,
    StudentLessonOverride,
    LessonMysql,
    Lesson,
    CourseMysql,
    Course,
  } = models;

  const StudentModel = StudentMysql || Student;
  const PasswordResetModel = PasswordResetMysql || PasswordReset;
  const DeviceSessionModel = DeviceSessionMysql || DeviceSession;
  const CenterModel = CenterMysql || Center;
  const StudentAttendanceModel = StudentAttendanceMysql || StudentAttendance;
  const StudentLessonOverrideModel = StudentLessonOverrideMysql || StudentLessonOverride;
  const LessonModel = LessonMysql || Lesson;
  const CourseModel = CourseMysql || Course;

  if (!StudentModel) {
    throw new Error("Student model (Student/StudentMysql) is not configured");
  }
  if (!DeviceSessionModel) {
    throw new Error(
      "DeviceSession model (DeviceSession/DeviceSessionMysql) is not configured"
    );
  }
  if (!PasswordResetModel) {
    console.warn(
      "[students.routes] PasswordReset model not configured - forgot/reset will fail"
    );
  }
  if (!CenterModel) {
    console.warn(
      "[students.routes] Center model not configured - center-related features will fail"
    );
  }

  /** ========== إنشاء حساب طالب جديد ========== */

  /**
   * @swagger
   * /students:
   *   post:
   *     summary: إنشاء حساب طالب جديد (Register)
   *     description: يقوم بإنشاء حساب طالب جديد، مع إمكانية ربطه بسنتر وتعيين centerCode فريد.
   *     tags: [Students]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentRegisterRequest'
   *     responses:
   *       200:
   *         description: تم إنشاء حساب الطالب بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentRegisterResponse'
   *       400:
   *         description: بيانات غير صالحة (validation errors أو سنة دراسية غير صالحة)
   *       409:
   *         description: إيميل أو رقم طالب أو centerCode مكرر
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.post("/", async (req, res, next) => {
    try {
      const body = req.body || {};
      const errs = validateBody(body);

      const levelNorm = normalizeLevel(body.year);
      if (!levelNorm) errs.push("السنة الدراسية غير صالحة");

      if (errs.length)
        return res.status(400).json({ success: false, errors: errs });

      const passwordHash = bcrypt.hashSync(String(body.password), 10);

      // السنتر اختياري
      let centerId = null;
      let centerName = null;

      // المحافظة اللي الطالب اختارها في الفورم
      let regionValue = String(body.region || "").trim();

      const hasCenterId =
        body.centerId !== undefined &&
        body.centerId !== null &&
        String(body.centerId).trim() !== "";

      if (hasCenterId) {
        if (!CenterModel) {
          return res.status(500).json({
            success: false,
            message: "نظام المراكز غير مهيأ حاليًا",
          });
        }

        const cid = Number(body.centerId);
        if (Number.isNaN(cid)) {
          return res
            .status(400)
            .json({ success: false, message: "centerId غير صالح" });
        }
        const center = await CenterModel.findOne({
          where: { id: cid, isDeleted: false, isActive: true },
        });
        if (!center) {
          return res.status(400).json({
            success: false,
            message: "السنتر غير موجود أو غير مُفعّل",
          });
        }
        if (
          levelNorm &&
          Array.isArray(center.levelsSupported) &&
          center.levelsSupported.length
        ) {
          if (!center.levelsSupported.includes(levelNorm)) {
            return res.status(400).json({
              success: false,
              message: "السنتر المحدد لا يدعم هذه السنة الدراسية",
            });
          }
        }
        centerId = center.id;
        centerName = center.name || null;

        // لو الطالب مابعتش محافظة لأي سبب، نستخدم المحافظة بتاعة السنتر
        const centerRegion = String(center.region || "").trim();
        if (!regionValue && centerRegion) regionValue = centerRegion;
      } else if (body.centerName) {
        centerName = String(body.centerName || "").trim() || null;
      }

      if (!regionValue) {
        return res.status(400).json({
          success: false,
          message: "المحافظة مطلوبة",
        });
      }

      const centerCode =
        String(body.centerCode || "")
          .trim()
          .toUpperCase() || null;

      // ⚠️ لو فيه centerCode لازم يكون فريد لكل طالب
      if (centerCode) {
        const existingByCode = await StudentModel.findOne({
          where: { centerCode },
        });
        if (existingByCode) {
          return res.status(409).json({
            success: false,
            message: "كود الطالب (centerCode) مستخدم بالفعل لطالب آخر",
          });
        }
      }

      const data = {
        studentName: String(body.studentName).trim(),
        email: String(body.email).trim().toLowerCase(),
        studentPhone: String(body.studentPhone).trim(),
        guardianPhone: String(body.guardianPhone).trim(),
        year: levelNorm,
        region: regionValue,
        centerId,
        centerName,
        centerCode,
        passwordHash,
        updatedAtLocal: new Date(),
      };

      const created = await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "create",
        data,
      });

      const safe = safeStudent(created);

      const accessToken = issueAccessToken({
        id: safe.id,
        role: "student",
        level: levelNorm,
      });

      if (req.session)
        req.session.user = { id: safe.id, role: "student", level: levelNorm };

      return res.json({
        success: true,
        data: { ...safe, level: levelNorm },
        accessToken,
      });
    } catch (e) {
      if (e?.name === "SequelizeUniqueConstraintError") {
        const fields = e?.fields || {};

        if (fields.email) {
          return res.status(409).json({
            success: false,
            message: "البريد الإلكتروني مسجل مسبقًا",
          });
        }
        if (fields.studentPhone) {
          return res.status(409).json({
            success: false,
            message: "رقم الطالب مسجل مسبقًا",
          });
        }
        if (fields.centerCode) {
          return res.status(409).json({
            success: false,
            message: "كود الطالب مستخدم بالفعل لطالب آخر",
          });
        }

        return res.status(409).json({
          success: false,
          message: "يوجد بيانات مكررة لا يمكن استخدامها",
        });
      }
      next(e);
    }
  });

  /** ========== تسجيل الدخول ========== */

  /**
   * @swagger
   * /students/login:
   *   post:
   *     summary: تسجيل دخول الطالب
   *     description: |
   *       يسمح للطالب بتسجيل الدخول باستخدام البريد الإلكتروني أو رقم الهاتف،
   *       مع إدارة الجلسات لكل جهاز (deviceId) وتطبيق حد أقصى لعدد الأجهزة المسموح بها.
   *     tags: [Students]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentLoginRequest'
   *     responses:
   *       200:
   *         description: تم تسجيل الدخول بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentLoginResponse'
   *       400:
   *         description: بيانات ناقصة (login/password)
   *       401:
   *         description: بيانات دخول غير صحيحة
   *       409:
   *         description: تعدى الحد الأقصى للأجهزة المسموح بها (MAX_DEVICES)
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.post("/login", async (req, res, next) => {
    try {
      const login = String(req.body?.login || "").trim();
      const password = String(req.body?.password || "");
      if (!login || !password)
        return res.status(400).json({
          success: false,
          message: "يرجى إدخال بيانات الدخول وكلمة السر",
        });

      const isEmail = login.includes("@");

      const student = await StudentModel.findOne({
        where: isEmail
          ? { email: login.toLowerCase() }
          : { studentPhone: login },
      });
      if (!student)
        return res
          .status(401)
          .json({ success: false, message: "بيانات دخول غير صحيحة" });

      const ok = bcrypt.compareSync(password, student.passwordHash || "");
      if (!ok)
        return res
          .status(401)
          .json({ success: false, message: "بيانات دخول غير صحيحة" });

      const lvNow = normalizeLevel(student.year) || student.year;
      if (lvNow !== student.year) {
        student.year = lvNow;
        student.updatedAtLocal = new Date();
        await student.save();
      }

      const deviceId =
        String(req.headers["x-device-id"] || req.body?.deviceId || "").trim() ||
        crypto.randomUUID();

      const userAgent = String(req.headers["user-agent"] || "").slice(0, 255);
      const ip = (
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        ""
      )
        .toString()
        .slice(0, 64);

      const activeSessions = await DeviceSessionModel.count({
        where: {
          studentId: student.id,
          revokedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      });

      let session = await DeviceSessionModel.findOne({
        where: { studentId: student.id, deviceId },
      });

      if (!session && activeSessions >= MAX_DEVICES) {
        return res.status(409).json({
          success: false,
          code: "MAX_DEVICES",
          message:
            "حسابك مستخدم بالفعل على جهاز. تواصل مع الدعم .",
        });
      }

      const refreshRaw = generateRefreshToken();
      const refreshHash = sha256(refreshRaw);
      const expiresAt = refreshExpiryDate();

      if (!session) {
        session = await DeviceSessionModel.create({
          studentId: student.id,
          deviceId,
          refreshHash,
          expiresAt,
          userAgent,
          ip,
          lastSeenAt: new Date(),
          revokedAt: null,
          updatedAtLocal: new Date(),
        });
      } else {
        Object.assign(session, {
          refreshHash,
          expiresAt,
          userAgent,
          ip,
          lastSeenAt: new Date(),
          revokedAt: null,
          updatedAtLocal: new Date(),
        });
        await session.save();
      }

      const accessToken = issueAccessToken({
        id: student.id,
        role: "student",
        level: lvNow,
      });
      if (REFRESH_IN_COOKIE) setRefreshCookie(res, refreshRaw);

      return res.json({
        success: true,
        data: {
          id: student.id,
          studentName: student.studentName,
          email: student.email,
          level: lvNow,
          deviceId,
          centerId: student.centerId ?? null,
          centerName: student.centerName ?? null,
          centerCode: student.centerCode ?? null,
        },
        accessToken,
        refreshToken: REFRESH_IN_COOKIE ? undefined : refreshRaw,
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== refresh ========== */

  /**
   * @swagger
   * /students/refresh:
   *   post:
   *     summary: تجديد accessToken باستخدام refreshToken
   *     description: |
   *       يستخدم لتجديد الـ accessToken بناءً على refreshToken المرتبط بـ deviceId.
   *       يمكن أن يُرسل refreshToken في الكوكي (refresh_token) أو في الـ body.
   *     tags: [Students]
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentRefreshRequest'
   *     responses:
   *       200:
   *         description: تم تجديد التوكن بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StudentRefreshResponse'
   *       400:
   *         description: refreshToken أو deviceId مفقود
   *       401:
   *         description: جلسة غير صالحة أو منتهية أو ملغاة
   *       404:
   *         description: الحساب غير موجود
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.post("/refresh", async (req, res, next) => {
    try {
      const raw =
        req.cookies?.refresh_token || String(req.body?.refreshToken || "");
      const deviceId = String(
        req.headers["x-device-id"] || req.body?.deviceId || ""
      ).trim();

      if (!raw || !deviceId)
        return res.status(400).json({
          success: false,
          message: "refreshToken و deviceId مطلوبان",
        });

      const hash = sha256(raw);
      const session = await DeviceSessionModel.findOne({
        where: { refreshHash: hash, deviceId },
      });

      if (!session)
        return res
          .status(401)
          .json({ success: false, message: "جلسة غير صالحة" });
      if (session.revokedAt)
        return res
          .status(401)
          .json({ success: false, message: "الجلسة ملغاة" });
      if (new Date(session.expiresAt).getTime() <= Date.now())
        return res
          .status(401)
          .json({ success: false, message: "انتهت صلاحية الجلسة" });

      const newRaw = generateRefreshToken();
      const newHash = sha256(newRaw);
      const newExp = refreshExpiryDate();

      session.refreshHash = newHash;
      session.expiresAt = newExp;
      session.lastSeenAt = new Date();
      session.updatedAtLocal = new Date();
      await session.save();

      const student = await StudentModel.findByPk(session.studentId);
      if (!student)
        return res
          .status(404)
          .json({ success: false, message: "الحساب غير موجود" });

      const levelNorm = normalizeLevel(student.year) || student.year;
      const accessToken = issueAccessToken({
        id: student.id,
        role: "student",
        level: levelNorm,
      });

      if (REFRESH_IN_COOKIE) setRefreshCookie(res, newRaw);

      res.json({
        success: true,
        accessToken,
        refreshToken: REFRESH_IN_COOKIE ? undefined : newRaw,
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== logout من جهاز معيّن ========== */

  /**
   * @swagger
   * /students/logout:
   *   post:
   *     summary: تسجيل خروج الطالب من جهاز معيّن
   *     description: يقوم بإلغاء الجلسة المرتبطة بـ deviceId للطالب الحالي، ومسح refresh_token من الكوكي.
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: header
   *         name: x-device-id
   *         schema:
   *           type: string
   *         required: false
   *         description: معرّف الجهاز المرتبط بالجلسة.
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               deviceId:
   *                 type: string
   *                 description: بديل للهيدر x-device-id.
   *     responses:
   *       200:
   *         description: تم تسجيل الخروج من هذا الجهاز بنجاح
   *       400:
   *         description: deviceId غير مرسل
   *       401:
   *         description: غير مصرح (بدون توكن)
   *       404:
   *         description: الجلسة غير موجودة
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.post("/logout", requireAuth, async (req, res, next) => {
    try {
      const deviceId = String(
        req.headers["x-device-id"] || req.body?.deviceId || ""
      ).trim();
      if (!deviceId)
        return res
          .status(400)
          .json({ success: false, message: "deviceId مطلوب" });

      const s = await DeviceSessionModel.findOne({
        where: { studentId: Number(req.user.id), deviceId },
      });
      if (!s)
        return res
          .status(404)
          .json({ success: false, message: "الجلسة غير موجودة" });

      s.revokedAt = new Date();
      s.updatedAtLocal = new Date();
      await s.save();

      if (req.cookies?.refresh_token) {
        res.clearCookie("refresh_token", { path: "/api/v1/students" });
      }

      res.json({ success: true, message: "تم تسجيل الخروج من هذا الجهاز" });
    } catch (e) {
      next(e);
    }
  });

  /** ========== forgot password (OTP via email) ========== */

  /**
   * @swagger
   * /students/forgot:
   *   post:
   *     summary: طلب استعادة كلمة المرور (إرسال OTP على الإيميل)
   *     description: يرسل كود تحقق (OTP) إلى البريد الإلكتروني في حالة وجود حساب مطابق، مع تطبيق rate limiting.
   *     tags: [Students]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentForgotRequest'
   *     responses:
   *       200:
   *         description: تم إرسال رمز التحقق إن وُجد حساب مطابق (لا يتم الإفصاح عن وجود الحساب من عدمه)
   *       400:
   *         description: البريد الإلكتروني غير مرسل
   *       429:
   *         description: محاولات متكررة خلال فترة قصيرة (throttled)
   *       500:
   *         description: ميزة الاستعادة غير مفعّلة أو خطأ داخلي
   */
  router.post("/forgot", async (req, res, next) => {
    try {
      if (!PasswordResetModel) {
        return res.status(500).json({
          success: false,
          message: "ميزة استعادة كلمة المرور غير مفعّلة حاليًا",
        });
      }

      const inputEmail = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      if (!inputEmail)
        return res.status(400).json({
          success: false,
          message: "يرجى إدخال البريد الإلكتروني",
        });

      const student = await StudentModel.findOne({
        where: { email: inputEmail },
      });

      // لا نفصح هل الإيميل موجود ولا لأ
      if (!student) {
        console.log("[forgot] student not found -> NO SEND");
        return res.json({
          success: true,
          message: "تم إرسال رمز التحقق إن وُجد حساب مطابق",
        });
      }

      // rate limit: دقيقة
      const oneMinAgo = new Date(Date.now() - 60 * 1000);
      const recent = await PasswordResetModel.findOne({
        where: {
          email: inputEmail,
          createdAt: { [Op.gte]: oneMinAgo },
        },
      });
      if (recent) {
        console.log("[forgot] throttled -> NO SEND");
        return res.status(429).json({
          success: false,
          message: "حاول مرة أخرى بعد لحظات",
        });
      }

      const otpLength = Number(process.env.OTP_LENGTH || 6);
      const otpExpMin = Number(process.env.OTP_EXP_MIN || 10);
      const otpMaxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);

      const otp = generateNumericOtp(otpLength);
      const otpHash = sha256Otp(otp);
      const expiresAt = minutesFromNow(otpExpMin);

      await PasswordResetModel.create({
        email: inputEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        maxAttempts: otpMaxAttempts,
      });

      console.log("[forgot] student found -> WILL SEND to", inputEmail);
      await sendOtpEmail(inputEmail, otp);

      return res.json({
        success: true,
        message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== reset password باستخدام OTP ========== */

  /**
   * @swagger
   * /students/reset:
   *   post:
   *     summary: استعادة كلمة المرور باستخدام OTP
   *     description: يتحقق من كود الـ OTP وصلاحيته ثم يقوم بتحديث كلمة المرور للطالب.
   *     tags: [Students]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentResetPasswordRequest'
   *     responses:
   *       200:
   *         description: تم تحديث كلمة السر بنجاح
   *       400:
   *         description: رمز غير صالح/منتهي/خاطئ أو بيانات غير مكتملة
   *       404:
   *         description: الحساب غير موجود
   *       429:
   *         description: تجاوز عدد محاولات إدخال الرمز
   *       500:
   *         description: ميزة الاستعادة غير مفعّلة أو خطأ داخلي
   */
  router.post("/reset", async (req, res, next) => {
    try {
      if (!PasswordResetModel) {
        return res.status(500).json({
          success: false,
          message: "ميزة استعادة كلمة المرور غير مفعّلة حاليًا",
        });
      }

      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const otp = String(req.body?.otp || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      const confirmNewPassword = String(req.body?.confirmNewPassword || "");

      if (!email || !otp || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: "يرجى إدخال جميع الحقول",
        });
      }
      // التعديل (يقبل 4 أرقام)
      if (newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          message: "الحد الأدنى لكلمة السر 4 أحرف",
        });
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: "كلمتا السر غير متطابقتين",
        });
      }

      const pr = await PasswordResetModel.findOne({
        where: { email },
        order: [["id", "DESC"]],
      });

      if (!pr)
        return res.status(400).json({
          success: false,
          message: "رمز غير صالح",
        });
      if (pr.usedAt)
        return res.status(400).json({
          success: false,
          message: "تم استخدام هذا الرمز من قبل",
        });
      if (new Date(pr.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          message: "انتهت صلاحية الرمز",
        });
      }
      if ((pr.attempts || 0) >= (pr.maxAttempts || 5)) {
        return res.status(429).json({
          success: false,
          message: "تجاوزت عدد المحاولات",
        });
      }

      const okOtp = sha256Otp(otp) === pr.otpHash;
      pr.attempts = (pr.attempts || 0) + 1;

      if (!okOtp) {
        await pr.save();
        return res.status(400).json({
          success: false,
          message: "رمز غير صحيح",
        });
      }

      const student = await StudentModel.findOne({
        where: { email },
      });
      if (!student)
        return res.status(404).json({
          success: false,
          message: "الحساب غير موجود",
        });

      const passwordHash = bcrypt.hashSync(newPassword, 10);

      await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "update",
        data: { passwordHash, updatedAtLocal: new Date() },
        where: { id: student.id },
      });

      pr.usedAt = new Date();
      await pr.save();

      return res.json({
        success: true,
        message: "تم تحديث كلمة السر بنجاح",
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== لستة الطلاب (بدون passwordHash) ========== */

  /**
   * @swagger
   * /students:
   *   get:
   *     summary: قائمة كل الطلاب (بدون passwordHash)
   *     description: تعيد قائمة بجميع الطلاب المخزنين في النظام، مع استبعاد حقل كلمة المرور المشفرة.
   *     tags: [Students]
   *     responses:
   *       200:
   *         description: تم إرجاع قائمة الطلاب بنجاح
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
   *                     $ref: '#/components/schemas/StudentSafe'
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
router.get("/", ...requireStaff, async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      const userCenterId = req.user?.centerId;

      const where = {};
      if (userRole === "center_manager" && userCenterId) {
        where.centerId = userCenterId;
      }

      const rows = await StudentModel.findAll({
        where,
        order: [["id", "ASC"]],
        attributes: { exclude: ["passwordHash"] },
      });
      return res.json({ success: true, data: rows });
    } catch (e) {
      next(e);
    }
  });

  /** ========== بيانات الطالب الحالي (me) ========== */

  /**
   * @swagger
   * /students/me:
   *   get:
   *     summary: جلب بيانات الطالب الحالي
   *     description: يعيد بيانات الطالب المرتبط بالتوكن الحالي (role=student).
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: تم جلب بيانات الحساب بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/StudentSafe'
   *       403:
   *         description: مخصص للطلاب فقط
   *       404:
   *         description: الحساب غير موجود
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.get("/me", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      const student = await StudentModel.findByPk(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "الحساب غير موجود" });
      }

      return res.json({
        success: true,
        data: safeStudent(student),
      });
    } catch (e) {
      next(e);
    }
  });

  // ✅ GET logged-in student's points history
  router.get("/me/points", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res.status(403).json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      if (!models.PointTransaction) {
        return res.status(500).json({ success: false, message: "PointTransaction model not found" });
      }

      const rows = await models.PointTransaction.findAll({
        where: { studentId },
        order: [["id", "DESC"]],
        limit: 100,
      });

      return res.json({ success: true, data: rows });
    } catch (e) {
      next(e);
    }
  });

  // ✅ POST claim quiz points
  router.post("/me/quiz-points", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res.status(403).json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ success: false, message: "السؤال مطلوب" });
      }

      if (!models.PointTransaction) {
        return res.status(500).json({ success: false, message: "PointTransaction model not found" });
      }

      // Check if they already solved any quiz today to prevent exploitation
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const alreadySolved = await models.PointTransaction.findOne({
        where: {
          studentId,
          reason: {
            [Op.like]: `حل الكويز السريع: %`
          },
          createdAtLocal: {
            [Op.gte]: todayStart
          }
        }
      });

      if (alreadySolved) {
        return res.status(400).json({
          success: false,
          message: "لقد حصلت بالفعل على نقاط الكويز اليوم! حاول مجدداً غداً مع كويز جديد."
        });
      }

      const student = await StudentModel.findByPk(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "الحساب غير موجود" });
      }

      const pointsAwarded = 5;
      const newTotal = (student.totalPoints || 0) + pointsAwarded;

      await student.update({ totalPoints: newTotal, updatedAtLocal: new Date() });

      const tx = await models.PointTransaction.create({
        studentId,
        points: pointsAwarded,
        reason: `حل الكويز السريع: ${String(question).substring(0, 80)}`,
        createdAtLocal: new Date()
      });

      return res.json({
        success: true,
        message: `تهانينا! تم إضافة ${pointsAwarded} نقاط لحسابك بنجاح.`,
        data: {
          totalPoints: newTotal,
          transaction: tx
        }
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== تعديل بيانات الحساب (me) ========== */

  /**
   * @swagger
   * /students/me:
   *   patch:
   *     summary: تعديل بيانات الطالب الحالي
   *     description: يسمح للطالب بتعديل بعض بيانات حسابه (الاسم، الإيميل، الهواتف، المحافظة).
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentUpdateMeRequest'
   *     responses:
   *       200:
   *         description: تم تحديث بيانات الحساب بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/StudentSafe'
   *       400:
   *         description: بيانات غير صالحة أو حقول غير مقبولة
   *       403:
   *         description: مخصص للطلاب فقط
   *       409:
   *         description: تعارض في بيانات فريدة (email, studentPhone, centerCode)
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.patch("/me", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      const body = req.body || {};
      const patch = { updatedAtLocal: new Date() };
      const errs = [];

      if (body.studentName !== undefined) {
        const name = String(body.studentName || "").trim();
        if (!name || name.length < 3) {
          errs.push("الاسم مطلوب وبحد أدنى 3 أحرف");
        } else {
          patch.studentName = name;
        }
      }

      if (body.email !== undefined) {
        const email = String(body.email || "")
          .trim()
          .toLowerCase();
        if (!email) {
          errs.push("البريد الإلكتروني مطلوب");
        } else {
          patch.email = email;
        }
      }

      if (body.studentPhone !== undefined) {
        const phone = String(body.studentPhone || "").trim();
        if (!phoneRegex.test(phone)) {
          errs.push("رقم الطالب غير صالح (01 + 9 أرقام)");
        } else {
          patch.studentPhone = phone;
        }
      }

      if (body.guardianPhone !== undefined) {
        const gPhone = String(body.guardianPhone || "").trim();
        if (!phoneRegex.test(gPhone)) {
          errs.push("رقم ولي الأمر غير صالح (01 + 9 أرقام)");
        } else {
          patch.guardianPhone = gPhone;
        }
      }

      if (body.region !== undefined) {
        const region = String(body.region || "").trim();
        if (!region) {
          errs.push("المحافظة مطلوبة");
        } else {
          patch.region = region;
        }
      }

      if (body.year !== undefined) {
         const currentMonth = new Date().getMonth() + 1; // 1-12
         if (currentMonth >= 8 && currentMonth <= 10) {
            const y = String(body.year || "").trim();
            if (y) patch.year = y;
         } else {
            errs.push("تعديل المرحلة الدراسية مسموح به فقط من شهر 8 إلى شهر 10");
         }
      }

      if (errs.length) {
        return res.status(400).json({ success: false, errors: errs });
      }

      await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "update",
        where: { id: studentId },
        data: patch,
      });

      const fresh = await StudentModel.findByPk(studentId);
      return res.json({ success: true, data: safeStudent(fresh) });
    } catch (e) {
      if (e?.name === "SequelizeUniqueConstraintError") {
        const fields = e?.fields || {};

        if (fields.email) {
          return res.status(409).json({
            success: false,
            message: "البريد الإلكتروني مسجل مسبقًا",
          });
        }
        if (fields.studentPhone) {
          return res.status(409).json({
            success: false,
            message: "رقم الطالب مسجل مسبقًا",
          });
        }
        if (fields.centerCode) {
          return res.status(409).json({
            success: false,
            message: "كود الطالب مستخدم بالفعل لطالب آخر",
          });
        }

        return res.status(409).json({
          success: false,
          message: "يوجد بيانات مكررة لا يمكن استخدامها",
        });
      }
      next(e);
    }
  });

  /** ========== تغيير كلمة المرور (مع معرفة الحالية) ========== */

  /**
   * @swagger
   * /students/change-password:
   *   post:
   *     summary: تغيير كلمة المرور للطالب الحالي
   *     description: يتأكد من كلمة المرور الحالية ثم يحدّث كلمة المرور الجديدة للطالب.
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentChangePasswordRequest'
   *     responses:
   *       200:
   *         description: تم تحديث كلمة السر بنجاح
   *       400:
   *         description: بيانات غير مكتملة أو كلمة مرور حالية خاطئة أو كلمة جديدة أقل من 6 أحرف
   *       403:
   *         description: مخصص للطلاب فقط
   *       404:
   *         description: الحساب غير موجود
   *       500:
   *         description: خطأ داخلي في السيرفر
   */
  router.post("/change-password", requireAuth, async (req, res, next) => {
    try {
      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");
      const confirmNewPassword = String(req.body?.confirmNewPassword || "");

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: "يرجى إدخال جميع الحقول",
        });
      }
      // التعديل (يقبل 4 أرقام)
      if (newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          message: "الحد الأدنى لكلمة السر 4 أحرف",
        });
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: "كلمتا السر غير متطابقتين",
        });
      }

      const student = await StudentModel.findByPk(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "الحساب غير موجود" });
      }

      const ok = bcrypt.compareSync(
        currentPassword,
        student.passwordHash || ""
      );
      if (!ok) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور الحالية غير صحيحة",
        });
      }

      const passwordHash = bcrypt.hashSync(newPassword, 10);

      await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "update",
        where: { id: studentId },
        data: { passwordHash, updatedAtLocal: new Date() },
      });

      return res.json({
        success: true,
        message: "تم تحديث كلمة السر بنجاح",
      });
    } catch (e) {
      next(e);
    }
  });

  /** ========== تعيين/تعديل/إزالة السنتر لاحقًا ========== */

  /**
   * @swagger
   * /students/me/center:
   *   patch:
   *     summary: تعيين أو تعديل أو إزالة سنتر الطالب الحالي
   *     description: |
   *       يسمح للطالب بتحديث بيانات السنتر الخاص به (centerId, centerName, centerCode)،
   *       مع التحقق من دعم السنتر لسنة الطالب الحالية وفردية centerCode لكل الطلاب.
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/StudentUpdateCenterRequest'
   *     responses:
   *       200:
   *         description: تم تحديث بيانات السنتر بنجاح
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/StudentSafe'
   *       400:
   *         description: centerId غير صالح أو السنتر لا يدعم سنة الطالب
   *       403:
   *         description: مخصص للطلاب فقط
   *       404:
   *         description: الحساب غير موجود أو السنتر غير موجود/غير مفعّل
   *       409:
   *         description: centerCode مستخدم بالفعل لطالب آخر
   *       500:
   *         description: نظام المراكز غير مهيأ أو خطأ داخلي
   */
  router.patch("/me/center", requireAuth, async (req, res, next) => {
    try {
      if (!CenterModel) {
        return res.status(500).json({
          success: false,
          message: "نظام المراكز غير مهيأ حاليًا",
        });
      }

      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط" });
      }
      const student = await StudentModel.findByPk(studentId);
      if (!student)
        return res
          .status(404)
          .json({ success: false, message: "الحساب غير موجود" });

      if (student.centerCode && student.centerCode.trim() !== '') {
          return res.status(403).json({
              success: false,
              message: "لا يمكنك إدخال كود سنتر جديد لأنك مسجل بكود بالفعل. يرجى مراجعة إدارة السنتر لتعديله."
          });
      }

      const body = req.body || {};
      const patch = { updatedAtLocal: new Date() };

      if (body.centerId !== undefined) {
        if (body.centerId === null || String(body.centerId).trim() === "") {
          patch["centerId"] = null;
          patch["centerName"] = null;
        } else {
          const cid = Number(body.centerId);
          if (Number.isNaN(cid))
            return res
              .status(400)
              .json({ success: false, message: "centerId غير صالح" });

          const center = await CenterModel.findOne({
            where: { id: cid, isDeleted: false, isActive: true },
          });
          if (!center)
            return res.status(400).json({
              success: false,
              message: "السنتر غير موجود أو غير مُفعّل",
            });

          const lvl = normalizeLevel(student.year) || student.year;
          if (
            lvl &&
            Array.isArray(center.levelsSupported) &&
            center.levelsSupported.length
          ) {
            if (!center.levelsSupported.includes(lvl))
              return res.status(400).json({
                success: false,
                message: "السنتر المحدد لا يدعم سنة الطالب الحالية",
              });
          }

          patch["centerId"] = center.id;
          patch["centerName"] = center.name || null;
        }
      }

      if (body.centerName !== undefined)
        patch["centerName"] = String(body.centerName || "").trim() || null;

      if (body.centerCode !== undefined) {
        const rawCode = String(body.centerCode || "")
          .trim()
          .toUpperCase();

        if (!rawCode) {
          patch["centerCode"] = null;
        } else {
          const existing = await StudentModel.findOne({
            where: {
              centerCode: rawCode,
              id: { [Op.ne]: studentId },
            },
          });

          if (existing) {
            return res.status(409).json({
              success: false,
              message: "كود الطالب مستخدم بالفعل لطالب آخر",
            });
          }

          patch["centerCode"] = rawCode;
        }
      }

      await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "update",
        where: { id: studentId },
        data: patch,
      });

      const fresh = await StudentModel.findByPk(studentId);
      return res.json({ success: true, data: safeStudent(fresh) });
    } catch (e) {
      next(e);
    }
  });
  // ===================================================================
  // 👫 Bulk Operations
  // ===================================================================

  /**
   * @swagger
   * /students/admin/bulk-import:
   *   post:
   *     summary: استيراد قائمة طلاب (Bulk Import)
   *     tags: [Students]
   *     security:
   *       - bearerAuth: []
   */
  router.post("/admin/bulk-import", ...requireStaff, async (req, res, next) => {
    try {
      const studentsData = req.body?.students || [];
      if (!Array.isArray(studentsData)) {
        return res.status(400).json({ success: false, message: "يجب إرسال قائمة طلاب في الحقل students" });
      }

      const results = {
        success: 0,
        updated: 0,
        failed: 0,
        errors: []
      };

      for (const s of studentsData) {
        try {
          // 1. Validation basics
          if (!s.studentName || (!s.email && !s.studentPhone)) {
            results.failed++;
            results.errors.push(`الطالب ${s.studentName || 'مجهول'}: بيانات ناقصة (الاسم أو البريد/الهاتف مطلوب)`);
            continue;
          }

          // 2. Find existing
          let existing = null;
          if (s.email) {
            existing = await StudentModel.findOne({ where: { email: s.email } });
          }
          if (!existing && s.studentPhone) {
            existing = await StudentModel.findOne({ where: { studentPhone: s.studentPhone } });
          }

          const levelNorm = normalizeLevel(s.year || "اولى ثانوى");
          
          const patch = {
            studentName: s.studentName,
            email: s.email || existing?.email,
            studentPhone: s.studentPhone || existing?.studentPhone,
            guardianPhone: s.guardianPhone || s.studentPhone,
            year: levelNorm || s.year || "اولى ثانوى",
            region: s.region || "القاهرة",
            centerCode: s.centerCode || existing?.centerCode,
            centerName: s.centerName || existing?.centerName,
            centerId: s.centerId || existing?.centerId,
            updatedAtLocal: new Date()
          };

          if (existing) {
            // Update
            await existing.update(patch);
            results.updated++;
          } else {
            // Create
            const password = s.password || s.studentPhone || "123456";
            const passwordHash = bcrypt.hashSync(String(password), 10);
            
            await StudentModel.create({
              ...patch,
              passwordHash,
              createdAtLocal: new Date()
            });
            results.success++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`خطأ في معالجة ${s.studentName}: ${err.message}`);
        }
      }

      return res.json({ success: true, data: results });
    } catch (e) {
      next(e);
    }
  });

  // ===================================================================

// ✅ List students for admin panel
router.get("/admin", ...requireStaff, async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const userCenterId = req.user?.centerId;

    const query = (req.query.q || "").trim();
    const where = {};
    if (query) {
      where[Op.or] = [
        { studentName: { [Op.like]: `%${query}%` } },
        { email: { [Op.like]: `%${query}%` } },
        { studentPhone: { [Op.like]: `%${query}%` } },
        { centerCode: { [Op.like]: `%${query}%` } },
      ];
    }

    if (userRole === "center_manager" && userCenterId) {
      where.centerId = userCenterId;
    }

    const rows = await StudentModel.findAll({
      where,
      limit: 50,
      order: [["id", "DESC"]],
      attributes: { exclude: ["passwordHash"] },
    });

    return res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

// ✅ Get single student
router.get("/admin/:id", ...requireStaff, async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const userCenterId = req.user?.centerId;

    const s = await StudentModel.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: "غير موجود" });

    // Ownership check for center managers
    if (userRole === "center_manager" && userCenterId && s.centerId !== userCenterId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بمشاهدة هذا الطالب" });
    }

    res.json({ success: true, data: safeStudent(s) });
  } catch (e) {
    next(e);
  }
});

// ✅ GET student attendance history
router.get("/admin/:id/attendance", ...requireStaff, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });

    const rows = await StudentAttendanceModel.findAll({
      where: { studentId },
      include: [
        { model: LessonModel, as: "lesson", attributes: ["id", "title", "kind"] },
        { model: CourseModel, as: "course", attributes: ["id", "title"] },
        { model: CenterModel, as: "center", attributes: ["id", "name"] },
      ],
      order: [["attendedAt", "DESC"], ["id", "DESC"]],
    });

    let rowsWithScore = rows;
    if (models.LessonExamScore) {
      const scores = await models.LessonExamScore.findAll({
        where: { studentId },
        raw: true
      });
      const scoreMap = {};
      scores.forEach(s => {
        scoreMap[s.lessonId] = { score: s.score, maxScore: s.maxScore };
      });
      rowsWithScore = rows.map(r => {
        const data = r.toJSON ? r.toJSON() : r;
        if (scoreMap[data.lessonId]) {
          data.examScore = scoreMap[data.lessonId].score;
          data.examMaxScore = scoreMap[data.lessonId].maxScore;
        }
        return data;
      });
    }

    return res.json({ success: true, data: rowsWithScore });
  } catch (e) {
    next(e);
  }
});

// ✅ GET student overrides
router.get("/admin/:id/overrides", ...requireStaff, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });

    const rows = await StudentLessonOverrideModel.findAll({
      where: { studentId },
      include: [
        { 
          model: LessonModel, 
          as: "lesson", 
          attributes: ["id", "title", "kind"],
          include: [
            { model: CourseModel, as: "course", attributes: ["id", "title"] }
          ]
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

// ✅ GET student points history
router.get("/admin/:id/points", ...requireStaff, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });

    if (!models.PointTransaction) {
      return res.status(500).json({ success: false, message: "PointTransaction model not found" });
    }

    const rows = await models.PointTransaction.findAll({
      where: { studentId },
      order: [["id", "DESC"]],
      limit: 100,
    });

    return res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

// ✅ POST add/deduct student points manually
router.post("/admin/:id/points", ...requireStaff, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    const { points, reason } = req.body;

    if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });
    if (!points || !reason) return res.status(400).json({ success: false, message: "النقاط والسبب مطلوبين" });

    const student = await StudentModel.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    // Ensure we don't drop below 0 points
    const newTotal = Math.max(0, (student.totalPoints || 0) + Number(points));

    await student.update({ totalPoints: newTotal, updatedAtLocal: new Date() });

    const tx = await models.PointTransaction.create({
      studentId,
      points: Number(points),
      reason,
      createdAtLocal: new Date()
    });

    return res.json({ success: true, message: "تم تحديث النقاط بنجاح", data: { totalPoints: newTotal, transaction: tx } });
  } catch (e) {
    next(e);
  }
});

// ✅ Extend attendance access
router.patch("/admin/:id/attendance/:attendanceId/extend", ...requireStaff, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    const attendanceId = Number(req.params.attendanceId);
    const { days } = req.body || {};

    if (!attendanceId || !days) {
      return res.status(400).json({ success: false, message: "attendanceId و days مطلوبين" });
    }

    const att = await StudentAttendanceModel.findOne({
      where: { id: attendanceId, studentId }
    });

    if (!att) return res.status(404).json({ success: false, message: "سجل الحضور غير موجود" });

    const currentExpiry = att.accessExpiresAt ? new Date(att.accessExpiresAt) : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + Number(days) * 24 * 60 * 60 * 1000);

    await performOperation({
      modelName: "StudentAttendance",
      mysqlModel: StudentAttendanceModel,
      op: "update",
      where: { id: attendanceId },
      data: { accessExpiresAt: newExpiry, updatedAtLocal: new Date() },
    });

    return res.json({ success: true, message: "تم تمديد الصلاحية بنجاح", data: { accessExpiresAt: newExpiry } });
  } catch (e) {
    next(e);
  }
});

// ✅ Create student from admin panel (uses same validation as register)
router.post("/admin", ...requireStaff, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errs = validateBody(body);

    const levelNorm = normalizeLevel(body.year);
    if (!levelNorm) errs.push("السنة الدراسية غير صالحة");

    if (errs.length) return res.status(400).json({ success: false, errors: errs });

    const passwordHash = bcrypt.hashSync(String(body.password), 10);

    // center resolution (same logic as register)
    let centerId = null;
    let centerName = null;
    let regionValue = String(body.region || "").trim();

    const hasCenterId =
      body.centerId !== undefined &&
      body.centerId !== null &&
      String(body.centerId).trim() !== "";

    if (hasCenterId) {
      if (!CenterModel) {
        return res.status(500).json({ success: false, message: "نظام المراكز غير مهيأ حاليًا" });
      }

      const cid = Number(body.centerId);
      if (Number.isNaN(cid)) {
        return res.status(400).json({ success: false, message: "centerId غير صالح" });
      }

      const center = await CenterModel.findOne({
        where: { id: cid, isDeleted: false, isActive: true },
      });

      if (!center) {
        return res.status(400).json({ success: false, message: "السنتر غير موجود أو غير مُفعّل" });
      }

      if (levelNorm && Array.isArray(center.levelsSupported) && center.levelsSupported.length) {
        if (!center.levelsSupported.includes(levelNorm)) {
          return res.status(400).json({ success: false, message: "السنتر المحدد لا يدعم هذه السنة الدراسية" });
        }
      }

      centerId = center.id;
      centerName = center.name || null;

      const centerRegion = String(center.region || "").trim();
      if (!regionValue && centerRegion) regionValue = centerRegion;
    } else if (body.centerName) {
      centerName = String(body.centerName || "").trim() || null;
    }

    if (!regionValue) {
      return res.status(400).json({ success: false, message: "المحافظة مطلوبة" });
    }

    const centerCode = String(body.centerCode || "").trim().toUpperCase() || null;

    if (centerCode) {
      const existingByCode = await StudentModel.findOne({ where: { centerCode } });
      if (existingByCode) {
        return res.status(409).json({
          success: false,
          message: "كود الطالب (centerCode) مستخدم بالفعل لطالب آخر",
        });
      }
    }

    const data = {
      studentName: String(body.studentName).trim(),
      email: String(body.email).trim().toLowerCase(),
      studentPhone: String(body.studentPhone).trim(),
      guardianPhone: String(body.guardianPhone).trim(),
      year: levelNorm,
      region: regionValue,
      centerId,
      centerName,
      centerCode,
      passwordHash,
      updatedAtLocal: new Date(),
      ...(StudentModel?.rawAttributes?.isDeleted ? { isDeleted: false } : {}),
    };

    const created = await performOperation({
      modelName: "Student",
      mysqlModel: StudentModel,
      op: "create",
      data,
    });

    return res.json({ success: true, data: safeStudent(created) });
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      const fields = e?.fields || {};
      if (fields.email) return res.status(409).json({ success: false, message: "البريد الإلكتروني مسجل مسبقًا" });
      if (fields.studentPhone) return res.status(409).json({ success: false, message: "رقم الطالب مسجل مسبقًا" });
      if (fields.centerCode) return res.status(409).json({ success: false, message: "كود الطالب مستخدم بالفعل لطالب آخر" });
      return res.status(409).json({ success: false, message: "يوجد بيانات مكررة لا يمكن استخدامها" });
    }
    next(e);
  }
});

// ✅ Update student from admin panel
router.patch("/admin/:id", ...requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: "id غير صالح" });
    }

    const existing = await StudentModel.findByPk(id);
    if (!existing) return res.status(404).json({ success: false, message: "الحساب غير موجود" });
    if (StudentModel?.rawAttributes?.isDeleted && existing.isDeleted) {
      return res.status(404).json({ success: false, message: "الحساب غير موجود" });
    }

    const body = req.body || {};
    const patch = { updatedAtLocal: new Date() };
    const errs = [];

    if (body.password !== undefined) {
      const pwd = String(body.password || "");
      if (pwd.length > 0) {
        if (pwd.length < 4) errs.push("كلمة السر يجب أن تكون 4 أحرف على الأقل");
        else {
          console.log('[updateStudent] Updating password for student id:', id);
          patch.passwordHash = bcrypt.hashSync(pwd, 10);
        }
      }
    }

    if (body.studentName !== undefined) {
      const name = String(body.studentName || "").trim();
      if (!name || name.length < 3) errs.push("الاسم مطلوب وبحد أدنى 3 أحرف");
      else patch.studentName = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) errs.push("البريد الإلكتروني مطلوب");
      else patch.email = email;
    }

    if (body.studentPhone !== undefined) {
      const phone = String(body.studentPhone || "").trim();
      if (!phoneRegex.test(phone)) errs.push("رقم الطالب غير صالح (01 + 9 أرقام)");
      else patch.studentPhone = phone;
    }

    if (body.guardianPhone !== undefined) {
      const gPhone = String(body.guardianPhone || "").trim();
      if (!phoneRegex.test(gPhone)) errs.push("رقم ولي الأمر غير صالح (01 + 9 أرقام)");
      else patch.guardianPhone = gPhone;
    }

    if (body.region !== undefined) {
      const region = String(body.region || "").trim();
      if (!region) errs.push("المحافظة مطلوبة");
      else patch.region = region;
    }

    const finalStudentPhone = patch.studentPhone || existing.studentPhone;
    const finalGuardianPhone = patch.guardianPhone || existing.guardianPhone;
    if (finalStudentPhone && finalGuardianPhone && finalStudentPhone === finalGuardianPhone) {
      errs.push("يجب أن يكون رقم الطالب مختلفاً عن رقم ولي الأمر");
    }

    if (body.year !== undefined) {
      const levelNorm = normalizeLevel(body.year);
      if (!levelNorm) errs.push("السنة الدراسية غير صالحة");
      else patch.year = levelNorm;
    }

    // centerId / centerName / centerCode
    if (body.centerId !== undefined) {
      if (body.centerId === null || String(body.centerId).trim() === "") {
        patch.centerId = null;
        patch.centerName = null;
      } else {
        if (!CenterModel) return res.status(500).json({ success: false, message: "نظام المراكز غير مهيأ حاليًا" });

        const cid = Number(body.centerId);
        if (Number.isNaN(cid)) return res.status(400).json({ success: false, message: "centerId غير صالح" });

        const center = await CenterModel.findOne({
          where: { id: cid, isDeleted: false, isActive: true },
        });
        if (!center) return res.status(400).json({ success: false, message: "السنتر غير موجود أو غير مُفعّل" });

        const lvl = normalizeLevel(body.year ?? existing.year) || (body.year ?? existing.year);
        if (lvl && Array.isArray(center.levelsSupported) && center.levelsSupported.length) {
          if (!center.levelsSupported.includes(lvl)) {
            return res.status(400).json({ success: false, message: "السنتر المحدد لا يدعم سنة الطالب الحالية" });
          }
        }

        patch.centerId = center.id;
        patch.centerName = center.name || null;
      }
    }

    if (body.centerName !== undefined) {
      patch.centerName = String(body.centerName || "").trim() || null;
    }

    if (body.centerCode !== undefined) {
      const rawCode = String(body.centerCode || "").trim().toUpperCase();
      if (!rawCode) {
        patch.centerCode = null;
      } else {
        const exists = await StudentModel.findOne({
          where: { centerCode: rawCode, id: { [Op.ne]: id } },
        });
        if (exists) return res.status(409).json({ success: false, message: "كود الطالب مستخدم بالفعل لطالب آخر" });
        patch.centerCode = rawCode;
      }
    }

    if (errs.length) return res.status(400).json({ success: false, errors: errs });
    
    console.log('[PATCH admin/:id] Prepared patch data:', { 
        ...patch, 
        passwordHash: patch.passwordHash ? '***HASHED***' : undefined 
    });

    await performOperation({
      modelName: "Student",
      mysqlModel: StudentModel,
      op: "update",
      where: { id },
      data: patch,
    });

    const fresh = await StudentModel.findByPk(id, {
      attributes: { exclude: ["passwordHash"] },
    });

    return res.json({ success: true, data: safeStudent(fresh) });
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      const fields = e?.fields || {};
      if (fields.email) return res.status(409).json({ success: false, message: "البريد الإلكتروني مسجل مسبقًا" });
      if (fields.studentPhone) return res.status(409).json({ success: false, message: "رقم الطالب مسجل مسبقًا" });
      if (fields.centerCode) return res.status(409).json({ success: false, message: "كود الطالب مستخدم بالفعل لطالب آخر" });
      return res.status(409).json({ success: false, message: "يوجد بيانات مكررة لا يمكن استخدامها" });
    }
    next(e);
  }
});

// ✅ Delete student (soft delete if supported, else hard delete)
router.delete("/admin/:id", ...requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: "id غير صالح" });
    }

    const student = await StudentModel.findByPk(id);
    if (!student) return res.status(404).json({ success: false, message: "الحساب غير موجود" });

    const now = new Date();
    const hasIsDeleted = !!StudentModel?.rawAttributes?.isDeleted;

    if (hasIsDeleted) {
      await performOperation({
        modelName: "Student",
        mysqlModel: StudentModel,
        op: "update",
        where: { id },
        data: { isDeleted: true, updatedAtLocal: now },
      });
    } else {
      // fallback: hard delete
      await StudentModel.destroy({ where: { id } });
    }

    return res.json({ success: true, message: "تم حذف الطالب", data: { id } });
  } catch (e) {
    next(e);
  }
});


  return router;
}

export default createStudentsRouter;
