// src/routes/playback-token.routes.js
import { Router } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../middlewares/auth.js';
import { createPlaybackToken, verifyPlaybackToken } from '../services/playback-token.service.js';
import { canAccessLesson } from '../middlewares/access.js';
import { hasEntitlement } from '../services/access.js';
import { checkAppVersion } from '../middlewares/version-check.js';
import { ENV } from '../config/env.js';
import { wrapProtectedVideo, generateSessionToken, extractYouTubeVideoId } from '../utils/video-security.js';
import crypto from 'crypto';

// Helper function لإخفاء المعلومات الحساسة في الـ logs
function hashSensitiveData(data) {
  if (!data) return 'null';
  const str = String(data);
  if (str.length <= 8) return '***';
  return createHash('sha256').update(str).digest('hex').substring(0, 8);
}

function maskToken(token) {
  if (!token || token.length < 16) return '***';
  return `${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
}

function createPlaybackTokenRouter(models) {
  const router = Router();

  const {
    LessonMysql,
    Lesson,
    CourseMysql,
    Course,
    StudentAttendanceMysql,
    StudentAttendance,
    StudentLessonOverrideMysql,
    StudentLessonOverride,
  } = models;

  const LessonModel = LessonMysql || Lesson || models.LessonMysql || models.Lesson || null;
  const CourseModel = CourseMysql || Course || models.CourseMysql || models.Course || null;
  const StudentAttendanceModel = StudentAttendanceMysql || StudentAttendance || models.StudentAttendanceMysql || models.StudentAttendance || null;
  const StudentLessonOverrideModel = StudentLessonOverrideMysql || StudentLessonOverride || models.StudentLessonOverrideMysql || models.StudentLessonOverride || null;

  /**
   * POST /api/v1/playback/token
   * إنشاء Token مشفر للوصول إلى الفيديو
   * 
   * Body: { courseId, lessonId }
   * Response: { success: true, token: "..." }
   */
  router.post('/token', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
        });
      }

      const { courseId, lessonId } = req.body;

      if (!courseId || !lessonId) {
        return res.status(400).json({
          success: false,
          message: 'courseId and lessonId are required',
        });
      }

      // التحقق من أن القيم أرقام صحيحة
      const courseIdNum = Number(courseId);
      const lessonIdNum = Number(lessonId);

      if (!Number.isFinite(courseIdNum) || !Number.isFinite(lessonIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'courseId and lessonId must be valid numbers',
        });
      }

      // التحقق من أن الدرس موجود وينتمي للكورس
      if (!LessonModel) {
        return res.status(500).json({ success: false, message: 'Lesson model not configured' });
      }

      const lesson = await LessonModel.findOne({
        where: { id: lessonIdNum, courseId: courseIdNum, isDeleted: false }
      });

      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'المحاضرة غير موجودة',
        });
      }

      // التحقق من الصلاحية (Security Check)
      const access = await hasEntitlement({
        models,
        studentId: Number(userId),
        resource: { type: 'COURSE', id: courseIdNum }
      });

      if (!access.ok && !lesson.isFreePreview) {
        return res.status(403).json({
          success: false,
          message: 'ليس لديك صلاحية لمشاهدة هذا الفيديو. يرجى الاشتراك بباقتك أو شراء الكورس أولاً.',
          reason: access.reason || 'NO_ENTITLEMENT'
        });
      }

      // إنشاء Token
      const token = createPlaybackToken({
        userId: Number(userId),
        courseId: courseIdNum,
        lessonId: lessonIdNum,
      });

      // Log بدون معلومات حساسة
      console.log('[PlaybackToken] Token created', {
        userIdHash: hashSensitiveData(userId),
        courseIdHash: hashSensitiveData(courseIdNum),
        lessonIdHash: hashSensitiveData(lessonIdNum),
        tokenPreview: maskToken(token),
      });

      return res.json({
        success: true,
        token,
        expiresIn: 7200, // ساعتين بالثواني
      });
    } catch (error) {
      // Log بدون تفاصيل الخطأ الحساسة
      console.error('[PlaybackToken] Error creating token:', error.name || 'UnknownError');
      return res.status(500).json({
        success: false,
        message: 'Failed to create playback token',
      });
    }
  });

  /**
   * GET /api/v1/playback/stream/:token
   * الحصول على بيانات الفيديو باستخدام Token
   * 
   * Response: { success: true, data: { streamType, streamUrl, videoId, ... } }
   */
  router.get('/stream/:token', checkAppVersion, async (req, res, next) => {
    try {
      const { token } = req.params;

      // Log بدون Token كامل
      console.log('[PlaybackToken] Stream request received', {
        tokenLength: token?.length || 0,
        tokenPreview: maskToken(token),
      });

      if (!token) {
        console.log('[PlaybackToken] Token is missing');
        return res.status(400).json({
          success: false,
          message: 'Token is required',
        });
      }

      // التحقق من Token (سماح بالاستخدام المتعدد ضمن نافذة الصلاحية لضمان الاستقرار)
      const verification = verifyPlaybackToken(token, { consume: false });

      // Log بدون معلومات حساسة
      console.log('[PlaybackToken] Token verification result:', {
        valid: verification.valid,
        hasError: !!verification.error,
        errorType: verification.error ? 'verification_failed' : null,
        userIdHash: verification.userId ? hashSensitiveData(verification.userId) : null,
        courseIdHash: verification.courseId ? hashSensitiveData(verification.courseId) : null,
        lessonIdHash: verification.lessonId ? hashSensitiveData(verification.lessonId) : null,
      });

      if (!verification.valid) {
        // Log more details about why it failed
        console.warn('[PlaybackToken] Token verification failed:', {
          error: verification.error,
          consumed: verification.consumed,
          expired: verification.expired,
          tokenPreview: maskToken(token),
          headers: {
            'x-app-version': req.headers['x-app-version'],
            'x-platform': req.headers['x-platform'],
            'x-player-protocol': req.headers['x-player-protocol']
          }
        });

        const customMessage = 'برجاء الرجوع للمنصة والضغط علي زر فتح في المشغل والانتظار وسيتم فتح الفيديو';

        // إذا كان التوكن مستخدم (consumed)، نؤخر الرد 3 ثواني لإظهار علامة التحميل (Splash) قبل ظهور الخطأ
        if (verification.consumed) {
          return setTimeout(() => {
            res.status(401).json({
              success: false,
              message: customMessage,
              expired: false,
            });
          }, 3500);
        }

        return res.status(401).json({
          success: false,
          message: customMessage,
          expired: verification.expired || false,
        });
      }

      const { userId, courseId, lessonId } = verification;

      // إضافة البيانات إلى req للاستخدام في middleware التالي
      req.playbackToken = {
        userId,
        courseId,
        lessonId,
      };

      console.log('[PlaybackToken] Token verified, proceeding to get stream data...');
      // استدعاء next للانتقال إلى middleware التالي (stream endpoint)
      next();
    } catch (error) {
      // Log بدون تفاصيل الخطأ الحساسة
      console.error('[PlaybackToken] Error verifying token:', error.name || 'UnknownError');
      return res.status(500).json({
        success: false,
        message: 'Token verification failed',
      });
    }
  }, async (req, res) => {
    try {
      const { userId, courseId, lessonId } = req.playbackToken;

      // Log بدون معلومات حساسة
      console.log('[PlaybackToken] Getting stream data', {
        userIdHash: hashSensitiveData(userId),
        courseIdHash: hashSensitiveData(courseId),
        lessonIdHash: hashSensitiveData(lessonId),
      });

      if (!LessonModel) {
        console.error('[PlaybackToken] Lesson model not configured');
        return res.status(500).json({
          success: false,
          message: 'Lesson model not configured',
        });
      }

      // الحصول على بيانات الدرس
      const lsn = await LessonModel.findOne({
        where: { id: lessonId, courseId },
      });

      console.log('[PlaybackToken] Lesson found:', lsn ? 'yes' : 'no');

      if (!lsn) {
        // Log بدون معلومات حساسة
        console.log('[PlaybackToken] Lesson not found', {
          lessonIdHash: hashSensitiveData(lessonId),
          courseIdHash: hashSensitiveData(courseId),
        });
        return res.status(404).json({
          success: false,
          message: 'المحاضرة غير موجودة',
        });
      }

      // التحقق من صلاحية الوصول باستخدام canAccessLesson
      // لكن بدون requireAuth لأننا استخدمنا Token
      // سنستخدم منطق مبسط للتحقق
      const now = new Date();

      // التحقق من preview مجاني
      if (lsn.isFreePreview) {
        // إرجاع بيانات الفيديو مباشرة
        return _returnStreamData(res, lsn, 'preview', userId);
      }

      // التحقق من الوصول عن طريق attendance
      if (StudentAttendanceModel) {
        let baseLessonId = lessonId;
        if (lsn.kind === 'homework' && lsn.parentLessonId) {
          baseLessonId = lsn.parentLessonId;
        }

        const att = await StudentAttendanceModel.findOne({
          where: {
            studentId: userId,
            courseId,
            lessonId: baseLessonId,
          },
          order: [['id', 'DESC']],
        });

        if (att) {
          const accessMode = att.accessMode;
          const kind = String(lsn.kind || '').toLowerCase();

          if (kind === 'lesson' && accessMode === 'FULL_LESSON') {
            if (!att.accessExpiresAt || new Date(att.accessExpiresAt) >= now) {
              if (att.maxViews == null || (att.viewsUsed || 0) < att.maxViews) {
                // تحديث viewsUsed
                await att.update({
                  viewsUsed: (att.viewsUsed || 0) + 1,
                  updatedAtLocal: now,
                });
                return _returnStreamData(res, lsn, 'attendance', userId);
              }
            }
          } else if (kind === 'homework' && ['HW_ONLY', 'FULL_LESSON'].includes(accessMode)) {
            if (!att.accessExpiresAt || new Date(att.accessExpiresAt) >= now) {
              if (att.maxViews == null || (att.viewsUsed || 0) < att.maxViews) {
                await att.update({
                  viewsUsed: (att.viewsUsed || 0) + 1,
                  updatedAtLocal: now,
                });
                return _returnStreamData(res, lsn, 'attendance', userId);
              }
            }
          }
        }
      }

      // التحقق من override
      // ملاحظة: جدول student_lesson_overrides لا يحتوي على courseId
      // لذلك نبحث فقط باستخدام studentId و lessonId
      if (StudentLessonOverrideModel) {
        const ov = await StudentLessonOverrideModel.findOne({
          where: {
            studentId: userId,
            lessonId,
          },
          order: [['id', 'DESC']],
        });

        if (ov) {
          // التحقق من أن override يسمح بالوصول للفيديو
          if (ov.allowVideoAccess) {
            if (!ov.expiresAt || new Date(ov.expiresAt) >= now) {
              if (ov.maxViews == null || (ov.viewsUsed || 0) < ov.maxViews) {
                await ov.update({
                  viewsUsed: (ov.viewsUsed || 0) + 1,
                  updatedAtLocal: now,
                });
                return _returnStreamData(res, lsn, 'override', userId);
              }
            }
          }
        }
      }

      // التحقق من أن التوكن صالح يعني أن المستخدم لديه صلاحية
      // لكن للأمان الإضافي ومنع استخدام التوكنات القديمة أو المسربة،
      // نعيد التحقق من الصلاحية (Entitlement) هنا بشكل إلزامي.
      console.log('[PlaybackToken] Re-verifying entitlement for student:', userId);
      
      const access = await hasEntitlement({
        models,
        studentId: userId,
        resource: { type: 'COURSE', id: courseId }
      });

      if (!access.ok && !lsn.isFreePreview) {
        console.warn('[PlaybackToken] Entitlement re-verification failed:', {
          userId,
          courseId,
          reason: access.reason
        });
        return res.status(403).json({
          success: false,
          message: 'ليس لديك صلاحية لمشاهدة هذا الفيديو. يرجى الاشتراك أو شراء الكورس أولاً.',
          reason: access.reason || 'NO_ENTITLEMENT'
        });
      }

      console.log('[PlaybackToken] Entitlement verified successfully, returning stream data');
      return _returnStreamData(res, lsn, 'token', userId);
    } catch (error) {
      // Log بدون تفاصيل الخطأ الحساسة
      console.error('[PlaybackToken] Error getting stream data:', error.name || 'UnknownError');
      return res.status(500).json({
        success: false,
        message: 'Failed to get stream data',
      });
    }
  });


  // Helper function لتحديد نوع الستريم النهائي (Immutable - لا يتغير بعد التحقق)
  function resolveStreamType(lessonData) {
    let streamType = String(lessonData.streamType || 'mp4').toLowerCase();
    let provider = String(lessonData.provider || '').toLowerCase();
    let videoId = lessonData.videoId;
    let streamUrl = lessonData.streamUrl;

    // ⚠️ أمني: التحقق من streamUrl وتحديد نوع الستريم النهائي قبل التحقق من الصلاحية
    // إذا كان streamUrl يحتوي على YouTube URL، يجب أن يكون streamType = 'external' في قاعدة البيانات
    // لكن للتوافق مع البيانات القديمة، نتحقق من streamUrl هنا
    if (streamUrl && (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be'))) {
      // إذا كان streamType في قاعدة البيانات 'mp4' لكن streamUrl هو YouTube
      // هذا يعني أن البيانات غير متسقة - يجب تصحيحها في قاعدة البيانات
      // لكن للتوافق، نحدد النوع الصحيح هنا
      streamType = 'external';
      provider = 'youtube';
      // استخراج videoId من URL إذا لم يكن موجوداً
      if (!videoId) {
        videoId = extractYouTubeVideoId(streamUrl);
      }
      streamUrl = null; // للفيديوهات الخارجية، نستخدم videoId فقط
    }

    return {
      streamType,
      provider,
      videoId,
      streamUrl,
    };
  }

  // Helper function للتحقق من صحة بيانات الستريم قبل الإرسال (Final Validation)
  function validateStreamData(streamData) {
    const { streamType, videoId, streamUrl } = streamData;

    // Validation نهائي: التحقق من أن البيانات متسقة
    if (streamType === 'external') {
      // 🛡️ NEW: Skip raw videoId check for protected videos (they use "parts" instead)
      if (streamData.isProtected) {
        return streamData;
      }
      if (!videoId) {
        throw new Error('External stream requires videoId');
      }
      if (streamUrl) {
        // streamUrl يجب أن يكون null للفيديوهات الخارجية
        streamData.streamUrl = null;
      }
    } else {
      // للأنواع الأخرى (mp4, hls, dash)
      if (!streamUrl) {
        throw new Error(`${streamType} stream requires streamUrl`);
      }
    }

    return streamData;
  }

  // Helper function لإرجاع بيانات الفيديو
  async function _returnStreamData(res, lsn, via, userId = null) {
    try {
      const lessonData = typeof lsn.toJSON === 'function' ? lsn.toJSON() : lsn;
      
      // 🛡️ SECURITY: Fetch student info for watermarking
      let studentInfo = { name: null, phone: null };
      if (userId && models.Student) {
        const student = await models.Student.findByPk(userId);
        if (student) {
          studentInfo.name = student.name || student.fullName;
          studentInfo.phone = student.phone || student.phoneNumber;
        }
      }

      // ⚠️ أمني: تحديد نوع الستريم النهائي قبل أي معالجة (Immutable)
      const resolved = resolveStreamType(lessonData);

      // Log بدون معلومات حساسة - نفس البيانات التي سيتم إرسالها
      console.log('[PlaybackToken] Preparing stream data', {
        lessonIdHash: hashSensitiveData(lessonData.id),
        streamType: resolved.streamType,
        provider: resolved.provider,
        hasVideoId: !!resolved.videoId,
        hasStreamUrl: !!resolved.streamUrl,
      });

      let streamData;

      // بناء streamData بناءً على النوع المحدد
      if (resolved.streamType === 'external') {
        const providerLower = String(resolved.provider || 'youtube').toLowerCase();

        // 🛡️ NEW: YouTube/Vimeo Protection Logic
        if ((providerLower === 'youtube' || providerLower === 'vimeo') && ENV.PROTECT_YOUTUBE_VIDEOS) {
          const studentId = userId || 'guest';
          const sessionToken = generateSessionToken(studentId, lessonData.id);
          const validationKey = crypto.createHash('md5').update(`v-key-${lessonData.id}-${ENV.SESSION_SECRET}`).digest('hex');

          const protectedData = wrapProtectedVideo(resolved.videoId, validationKey, sessionToken);

          streamData = {
            success: true,
            streamType: 'external',
            provider: providerLower,
            videoId: null, // Zero out raw ID for new apps (Protocol 2+)
            isProtected: true,
            ...protectedData,
            thumbnailUrl: lessonData.thumbnailUrl || null,
            via,
          };
        } else {
          streamData = {
            streamType: 'external',
            provider: providerLower,
            streamUrl: null,
            videoId: resolved.videoId || null,
            thumbnailUrl: lessonData.thumbnailUrl || null,
            via,
          };
        }
      } else {
        // للأنواع الأخرى (mp4, hls, dash, vdocipher)
        streamData = {
          streamType: resolved.streamType || 'mp4',
          streamUrl: resolved.streamUrl || null,
          videoId: resolved.videoId || null,
          provider: resolved.provider || null,
          thumbnailUrl: lessonData.thumbnailUrl || null,
          via,
        };
      }

      // ⚠️ أمني: Validation نهائي قبل الإرسال
      validateStreamData(streamData);

      // إضافة lessonId و courseId و studentId للاستخدام في تتبع التقدم والعلامة المائية
      streamData.lessonId = lessonData.id;
      streamData.courseId = lessonData.courseId;
      streamData.studentId = userId;
      streamData.studentName = studentInfo.name;   // ⚡ NEW
      streamData.studentPhone = studentInfo.phone; // ⚡ NEW
      streamData.durationSec = lessonData.durationSec || null;
      streamData.lessonTitle = lessonData.title || null;

      const response = {
        success: true,
        data: streamData,
      };

      // Log متسق: نفس البيانات التي تم إعدادها
      console.log('[PlaybackToken] Sending stream data response:', {
        success: response.success,
        streamType: streamData.streamType,
        provider: streamData.provider,
        hasVideoId: !!streamData.videoId,
        hasStreamUrl: !!streamData.streamUrl,
      });

      // إرجاع البيانات مع wrapper "data" كما يتوقع Flutter player
      return res.json(response);
    } catch (error) {
      // Log the actual error for the developer
      console.error('[PlaybackToken] Critical error in _returnStreamData:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to prepare stream data',
      });
    }
  }

  return router;
}

export default createPlaybackTokenRouter;
