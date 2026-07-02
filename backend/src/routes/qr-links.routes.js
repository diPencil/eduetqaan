// src/routes/qr-links.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { hasEntitlement } from '../services/access.js';
import { ENV } from '../config/env.js';
import { wrapProtectedVideo, generateSessionToken, extractYouTubeVideoId } from '../utils/video-security.js';
import crypto from 'crypto';

/** ============== Helpers ============== */
function candidatesContainers(models) {
  const arr = [models];
  if (models?.mysql) arr.push(models.mysql);
  if (models?.mysqlModels) arr.push(models.mysqlModels);
  if (models?.Mysql) arr.push(models.Mysql);
  if (models?.MySQL) arr.push(models.MySQL);
  if (models?.db?.mysql) arr.push(models.db.mysql);
  return arr.filter(Boolean);
}

function resolveModel(models, names) {
  const containers = candidatesContainers(models);
  for (const container of containers) {
    for (const name of names) {
      if (container?.[name]) return container[name];
    }
  }
  return undefined;
}

function ensureModel(model, label, names) {
  if (model?.findOne || model?.create) return;
  const hint = Array.isArray(names) ? names.join(' | ') : String(names || '');
  const err = new Error(
    `QrLinksRouter: missing model "${label}". Expected one of: ${hint}.`
  );
  err.status = 500;
  throw err;
}

export function createQrLinksRouter(models) {
  const router = Router();

  const QrSnippetModel = resolveModel(models, ['QrSnippetMysql', 'QrSnippetMySQL', 'QrSnippet', 'QrSnippetModel']);
  const StudentQrViewModel = resolveModel(models, ['StudentQrViewMysql', 'StudentQrViewMySQL', 'StudentQrView', 'StudentQrViewModel']);
  const StudentAttendanceModel = resolveModel(models, ['StudentAttendanceMysql', 'StudentAttendanceMySQL', 'StudentAttendance', 'StudentAttendanceModel']);

  ensureModel(QrSnippetModel, 'QrSnippet', ['QrSnippetMysql', 'QrSnippet']);
  ensureModel(StudentQrViewModel, 'StudentQrView', ['StudentQrViewMysql', 'StudentQrView']);

  router.get('/:token', requireAuth, async (req, res, next) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) {
        return res.json({
          success: false,
          ok: false,
          message: 'رمز QR غير صالح.',
        });
      }

      const studentId = Number(req.user?.id);
      if (!studentId || req.user?.role !== 'student') {
        return res.status(403).json({
          success: false,
          ok: false,
          message: 'مصرّح للطلاب فقط.',
        });
      }

      const qr = await QrSnippetModel.findOne({
        where: { token, isActive: true },
      });

      if (!qr) {
        return res.json({
          success: false,
          ok: false,
          message: 'الكود غير صالح أو غير مفعّل.',
        });
      }

      const now = new Date();
      if (qr.linkExpiresAt && new Date(qr.linkExpiresAt).getTime() < now.getTime()) {
        return res.json({
          success: false,
          ok: false,
          message: 'انتهت صلاحية هذا الكود.',
        });
      }

      // 🛡️ Security Check: Grade Isolation & Entitlement
      const access = await hasEntitlement({
        models,
        studentId,
        resource: { type: 'COURSE', id: qr.courseId }
      });

      // We allow QR access if grades match, even if not purchased (for snippets)
      // UNLESS the reason is GRADE_MISMATCH
      if (!access.ok && access.reason === 'GRADE_MISMATCH') {
        return res.status(403).json({
          success: false,
          ok: false,
          code: 'GRADE_MISMATCH',
          message: 'عذراً، هذا المحتوى مخصص لمرحلة دراسية أخرى.'
        });
      }

      // optional: ensure they have access to the course if it's not a free snippet
      // (Depends on business logic, but Grade Isolation is mandatory)

      // attendance optional
      let attendanceId = null;
      if (StudentAttendanceModel?.findOne) {
        const att = await StudentAttendanceModel.findOne({
          where: {
            studentId,
            courseId: qr.courseId,
            lessonId: qr.lessonId,
          },
          order: [['id', 'DESC']],
        });
        if (att) attendanceId = att.id;
      }

      // Upsert StudentQrView
      let view = await StudentQrViewModel.findOne({
        where: { studentId, qrId: qr.id },
      });

      if (!view) {
        const data = {
          studentId,
          qrId: qr.id,
          courseId: qr.courseId,
          lessonId: qr.lessonId,
          attendanceId,
          viewsCount: 1,
          firstViewedAt: now,
          lastViewedAt: now,
          updatedAtLocal: now,
          createdAt: now,
        };

        view = await StudentQrViewModel.create(data);
      } else {
        const patch = {
          viewsCount: (view.viewsCount || 0) + 1,
          lastViewedAt: now,
          updatedAtLocal: now,
        };

        if (!view.attendanceId && attendanceId) {
          patch.attendanceId = attendanceId;
        }

        await view.update(patch);
      }

      const providerLower = String(qr.provider || '').toLowerCase();
      let videoUrl = qr.streamUrl;
      let protectedData = {};

      // 🛡️ Security: YouTube/Vimeo Protection Logic
      if ((providerLower === 'youtube' || providerLower === 'vimeo') && ENV.PROTECT_YOUTUBE_VIDEOS) {
        const studentId = req.user?.id || 'guest';
        const sessionToken = generateSessionToken(studentId, qr.id);
        const validationKey = crypto.createHash('md5').update(`v-key-qr-${qr.id}-${ENV.SESSION_SECRET}`).digest('hex');
        
        const videoId = extractYouTubeVideoId(qr.streamUrl);
        protectedData = wrapProtectedVideo(videoId, validationKey, sessionToken);
        videoUrl = null; // Zero out raw URL for protected mode
      }

      const payload = {
        id: qr.id,
        title: qr.title,
        description: qr.description || null,
        subject: qr.subject || null,
        teacher: qr.teacher || null,
        videoUrl,
        isProtected: !!protectedData.fakeVideos,
        ...protectedData,
        posterUrl: qr.posterUrl || null,
        expiresAt: qr.linkExpiresAt ? new Date(qr.linkExpiresAt).toISOString() : null,
        courseId: qr.courseId,
        lessonId: qr.lessonId,
        startAt: qr.startAt || 0,
        endAt: qr.endAt || null,
      };

      return res.json({
        success: true,
        ok: true,
        data: payload,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export default createQrLinksRouter;
