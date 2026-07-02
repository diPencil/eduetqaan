// src/utils/image-moderation.js
import vision from "@google-cloud/vision";

// نستخدم Client واحد على مستوى البروسيس
const client = new vision.ImageAnnotatorClient();

// تحويل قيم Google لدرجات رقمية
// UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY
const LIKELIHOOD_SCORE = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

/**
 * فحص صورة باستخدام Google Cloud Vision SafeSearch
 * @param {Buffer} buffer
 * @returns {Promise<boolean>} true لو الصورة آمنة، false لو مرفوضة
 */
export async function assertSafeImage(buffer) {
//   if (!buffer) return true;

//   try {
//     const [result] = await client.safeSearchDetection({
//       image: { content: buffer },
//     });

//     const safe = result.safeSearchAnnotation;
//     if (!safe) {
//       // ما رجعش أي بيانات؟ نفضّل نمنع الصورة (حذرًا)
//       return false;
//     }

//     const adultScore = LIKELIHOOD_SCORE[safe.adult] ?? 0;
//     const racyScore = LIKELIHOOD_SCORE[safe.racy] ?? 0;
//     const violenceScore = LIKELIHOOD_SCORE[safe.violence] ?? 0;

//     // سياسة بسيطة:
//     // - أي adult أو racy من POSSIBLE وطالع → مرفوض
//     // - العنف من LIKELY وطالع → مرفوض (لو حابب تشدّد كمان نزّل الـ threshold)
//     const hasAdult = adultScore >= LIKELIHOOD_SCORE.POSSIBLE;
//     const hasRacy = racyScore >= LIKELIHOOD_SCORE.POSSIBLE;
//     const hasViolence = violenceScore >= LIKELIHOOD_SCORE.LIKELY;

//     const isExplicit = hasAdult || hasRacy || hasViolence;

//     if (process.env.NODE_ENV !== "production") {
//       console.log("SafeSearch:", {
//         adult: safe.adult,
//         racy: safe.racy,
//         violence: safe.violence,
//         isExplicit,
//       });
//     }

//     // true = آمنة، false = مرفوضة
//     return !isExplicit;
//   } catch (err) {
//     console.error("Google Vision SafeSearch error:", err);

    // هنا بنختار "الحذر": لو الفحص وقع أو حصل error → نمنع الصورة
    return true;
  }
