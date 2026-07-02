// src/routes/vdocipher.routes.js

import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middlewares/auth.js';
import { hasEntitlement } from '../services/access.js';

export default function createVdocipherRouter(models) {
  const router = Router();

  const LessonModel = models.LessonMysql || models.Lesson || null;

  router.get('/otp', requireAuth, async (req, res) => {
    try {
      // ===== 1) videoId من الـ query =====
      const rawVideoId = req.query.videoId;
      const videoId = typeof rawVideoId === 'string' ? rawVideoId.trim() : '';

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'videoId is required',
        });
      }

      // ===== 2) التحقق من الصلاحية (Security Check) =====
      const studentId = req.user?.id;
      if (!studentId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // البحث عن الدرس المرتبط بهذا الفيديو
      if (!LessonModel) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: Lesson model not found' });
      }

      const lesson = await LessonModel.findOne({
        where: { videoId, isDeleted: false }
      });

      if (!lesson) {
        return res.status(404).json({ success: false, message: 'المحاضرة غير موجودة' });
      }

      // التحقق من أن الطالب يمتلك صلاحية الوصول للكورس
      const access = await hasEntitlement({
        models,
        studentId,
        resource: { type: 'COURSE', id: lesson.courseId }
      });

      if (!access.ok && !lesson.isFreePreview) {
        console.warn('[VdoCipher] Unauthorized OTP request attempt:', {
          studentId,
          videoId,
          courseId: lesson.courseId,
          reason: access.reason
        });
        return res.status(403).json({
          success: false,
          message: 'ليس لديك صلاحية لمشاهدة هذا الفيديو. يرجى الاشتراك أو شراء الكورس أولاً.',
          reason: access.reason || 'NO_ENTITLEMENT'
        });
      }

      // ===== 3) user data: من req.user أو من الـ query كـ fallback =====
      const appUser = req.user || {};

      const queryUserName =
        typeof req.query.userName === 'string' && req.query.userName.trim()
          ? req.query.userName.trim()
          : null;

      const queryUserEmail =
        typeof req.query.userEmail === 'string' && req.query.userEmail.trim()
          ? req.query.userEmail.trim()
          : null;

      const userId = appUser.id ?? appUser.userId ?? null;

      const userName =
        appUser.name ||
        appUser.fullName ||
        appUser.username ||
        queryUserName ||
        'Student';

      const userEmail =
        appUser.email ||
        appUser.userEmail ||
        queryUserEmail ||
        'student@example.com';

      const VDOCIPHER_API_SECRET = process.env.VDOCIPHER_API_SECRET;
      const VDOCIPHER_BASE_URL = 'https://dev.vdocipher.com/api/videos';

      if (!VDOCIPHER_API_SECRET) {
        console.error('[VdoCipher] Missing VDOCIPHER_API_SECRET env var');
        return res.status(500).json({
          success: false,
          message: 'VDOCIPHER_API_SECRET is not configured on the server',
        });
      }

      // ===== 4) إعداد playbackInfo حسب Docs =====
      const playbackInfo = JSON.stringify({
        video: {
          id: videoId,
        },
        user: {
          id: userId,
          name: userName,
          email: userEmail,
        },
        // meta: { source: 'mansa-app' },
      });

      console.log('[VdoCipher] Requesting OTP for video:', videoId, {
        userId,
        userName,
        userEmail,
        via: lesson.isFreePreview ? 'free_preview' : 'entitlement'
      });

      // ===== 5) الاتصال بـ VdoCipher =====
      const otpResp = await axios.post(
        `${VDOCIPHER_BASE_URL}/${videoId}/otp`,
        {
          ttl: 3600, // 1 ساعة
          playbackInfo,
        },
        {
          headers: {
            Authorization: `Apisecret ${VDOCIPHER_API_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return res.json({
        success: true,
        otp: otpResp.data.otp,
        playbackInfo: otpResp.data.playbackInfo,
      });
    } catch (err) {
      // ===== 6) لوج واضح جداً للسبب الحقيقي =====
      const status = err?.response?.status || 500;
      const apiError = err?.response?.data;

      console.error('[VdoCipher OTP error]', {
        status,
        apiError,
        message: err?.message,
      });

      return res.status(status).json({
        success: false,
        message: 'Failed to generate VdoCipher OTP',
        error: apiError || err?.message || 'Unknown error',
      });
    }
  });

  return router;
}

