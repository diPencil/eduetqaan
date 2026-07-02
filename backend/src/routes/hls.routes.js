// src/routes/hls.routes.js
import { Router } from 'express';
import { verifyPlaybackToken } from '../services/playback-token.js';
import { getLessonKeyBytes } from '../services/keys.js'; // هترجع Buffer للمفتاح

const r = Router();

/**
 * @swagger
 * tags:
 *   name: HLS
 *   description: |
 *     مسارات خاصة ببث الفيديو المحمي (HLS) وتوزيع مفاتيح فك التشفير.
 */

/**
 * @swagger
 * /hls/key:
 *   get:
 *     summary: Get HLS decryption key
 *     description: |
 *       يُستخدم هذا المسار لإرجاع مفتاح التشفير (AES key) الخاص بدرس معيّن،
 *       بعد التحقق من صلاحية توكن المشاهدة (playback token).
 *
 *       ⚠️ ملاحظة:
 *       - هذا المسار موجّه لمخدّم الـ HLS أو الـ player فقط، وليس للاستخدام المباشر من المتصفح.
 *       - يتم التحقق من أن `lessonId` في التوكن يطابق `lessonId` المرسلة في الـ query.
 *     tags: [HLS]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         description: |
 *           توكن المشاهدة الموقّع (JWT أو مشابه) الذي يحتوي على `lessonId`
 *           وأيClaims إضافية (مثل userId, deviceId...).
 *         schema:
 *           type: string
 *       - in: query
 *         name: kid
 *         required: true
 *         description: |
 *           معرّف المفتاح (Key ID) المستخدم لجلب الـ AES key من الـ storage.
 *         schema:
 *           type: string
 *       - in: query
 *         name: lessonId
 *         required: true
 *         description: المعرف الداخلي للدرس المرتبط بهذا المفتاح.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Raw HLS decryption key (AES key bytes)
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing or invalid query parameters (token/kid/lessonId).
 *       403:
 *         description: |
 *           - التوكن غير صالح أو منتهي.
 *           - أو lessonId في التوكن لا يطابق lessonId في الطلب.
 *       500:
 *         description: خطأ غير متوقع في السيرفر أثناء جلب المفتاح.
 */
r.get('/key', async (req, res) => {
  try {
    const { token, kid, lessonId } = req.query;
    if (!token || !kid || !lessonId) return res.sendStatus(400);

    const claims = verifyPlaybackToken(String(token));
    if (String(claims.lessonId) !== String(lessonId)) return res.sendStatus(403);

    // (اختياري) اربط بـ IP/UA/DeviceId لتقليل المشاركة
    // if (claims.deviceId !== hash(req.headers['user-agent']+ip)) return res.sendStatus(403);

    const keyBuf = await getLessonKeyBytes(String(kid));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(keyBuf);
  } catch {
    res.sendStatus(403);
  }
});

export default r;
