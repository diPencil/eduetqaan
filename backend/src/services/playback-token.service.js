// src/services/playback-token.service.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { ENV } from '../config/env.js';

const TOKEN_SECRET = ENV.PLAYBACK_TOKEN_SECRET;
const TOKEN_EXPIRY_SECONDS = 600; // 10 دقائق لتجنب انتهاء الصلاحية على الشبكات البطيئة

// Store for consumed token JTIs to enforce single-use
// Key: jti (string), Value: expiry timestamp (number)
const consumedTokens = new Map();

// Periodically clean up expired tokens from memory every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of consumedTokens.entries()) {
    if (now > expiry) {
      consumedTokens.delete(jti);
    }
  }
}, 60 * 1000).unref(); // unref so it doesn't keep the process alive

/**
 * إنشاء Token مشفر للوصول إلى الفيديو
 * @param {Object} params
 * @param {number} params.userId - معرف المستخدم
 * @param {number} params.courseId - معرف الكورس
 * @param {number} params.lessonId - معرف الدرس
 * @returns {string} Token مشفر
 */
export function createPlaybackToken({ userId, courseId, lessonId }) {
  if (!userId || !courseId || !lessonId) {
    throw new Error('userId, courseId, and lessonId are required');
  }

  const payload = {
    jti: crypto.randomBytes(16).toString('hex'), // Unique token ID
    userId: Number(userId),
    courseId: Number(courseId),
    lessonId: Number(lessonId),
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS, // Expires in 60 seconds
  };

  try {
    const token = jwt.sign(payload, TOKEN_SECRET, {
      algorithm: 'HS256',
      issuer: 'etqan-platform',
      audience: 'samy-player',
    });

    return token;
  } catch (error) {
    console.error('[PlaybackToken] Error creating token:', error);
    throw new Error('Failed to create playback token');
  }
}

/**
 * التحقق من Token واستخراج البيانات
 * @param {string} token - Token للتحقق منه
 * @param {Object} options - خيارات إضافية
 * @param {boolean} options.consume - هل يجب استهلاك التوكن لمرة واحدة؟
 * @returns {Object} { userId, courseId, lessonId, valid }
 */
export function verifyPlaybackToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  try {
    const decoded = jwt.verify(token, TOKEN_SECRET, {
      issuer: 'etqan-platform',
      audience: 'samy-player',
    });

    // التحقق من وجود الحقول المطلوبة
    if (!decoded.userId || !decoded.courseId || !decoded.lessonId) {
      return { valid: false, error: 'Invalid token payload' };
    }

    // التحقق من أن التوكن لم يتم استهلاكه إذا طلبنا استهلاكه
    if (options.consume && decoded.jti) {
      if (consumedTokens.has(decoded.jti)) {
        return { valid: false, error: 'Token has already been used', consumed: true };
      }
      // تحديد التوكن كمستهلك وإعطائه وقت انتهاء (تاريخ الانتهاء الأصلي + دقيقة أمان إضافية)
      consumedTokens.set(decoded.jti, (decoded.exp * 1000) + 60000);
    }

    return {
      valid: true,
      userId: Number(decoded.userId),
      courseId: Number(decoded.courseId),
      lessonId: Number(decoded.lessonId),
      expiresAt: new Date(decoded.exp * 1000),
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token has expired', expired: true };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token format' };
    }
    console.error('[PlaybackToken] Error verifying token:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * إنشاء Token مؤقت للاستخدام مرة واحدة (اختياري)
 * @param {Object} params
 * @returns {string} Token
 */
export function createSingleUseToken({ userId, courseId, lessonId }) {
  // يمكن إضافة منطق إضافي للـ single-use tokens
  return createPlaybackToken({ userId, courseId, lessonId });
}
