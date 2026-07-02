// src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger/swagger.config.js";

// Routers الأساسية
import { createClientsRouter } from "./routes/clients.routes.js";
import { createStudentsRouter } from "./routes/students.routes.js";
import healthRoutes from "./routes/health.routes.js";
import createCoursesRouter from "./routes/courses.routes.js";
import createCheckoutRouter from "./routes/checkout.routes.js";
import createPlansRouter from "./routes/plans.routes.js";
import createUsersRouter from "./routes/users.routes.js";
import createVouchersRouter from "./routes/vouchers.routes.js";
import createWalletRouter from "./routes/wallet.routes.js";
import createAdminTopupsRouter from "./routes/admin.topups.routes.js";
import createCommunityRouter from "./routes/community.routes.js";
import hlsRouter from "./routes/hls.routes.js";
import createFaqRouter from "./routes/faq.routes.js";
import createSelfQuizRouter from "./routes/self-quiz.routes.js";
import createMapFaqRouter from "./routes/map-faq.routes.js";
import createDeviceSessionsRouter from "./routes/device-sessions.routes.js";
import createCentersRouter from "./routes/centers.routes.js";
import createAdminExamsRouter from "./routes/admin.exams.routes.js";

import createAuthRouter from "./routes/auth.routes.js";

import createGamesRouter from "./routes/games.routes.js";

import createQrLinksRouter from "./routes/qr-links.routes.js";
import createQrSnippetsRouter from "./routes/qr-snippets.routes.js";

import createStudentInsightsRouter from "./routes/student-insights.routes.js";
import createNotificationsRouter from "./routes/notifications.routes.js";

import createCertificatesRouter from "./routes/certificates.routes.js";

import createStudentActivityRouter from "./routes/student-activity.routes.js";
import createStudentHomeworkRouter from "./routes/student-homework.routes.js"; // ⚡ NEW
import { createCenterAttendanceRouter as createCenterAttendanceCourseRouter } from "./routes/center-attendance-course.routes.js";
import { createCenterAttendanceRouter } from "./routes/center-attendance.routes.js";
import createLiveRequestsRouter from "./routes/live-requests.routes.js";
import { createAppRouter } from "./routes/app.routes.js";
import { createSyncRouter } from "./routes/sync.routes.js";

// NEW: الراوترات الجديدة
import createAttendanceRouter from "./routes/attendance.routes.js";
import createProgressRouter from "./routes/progress.routes.js";

import createExamsRouter from "./routes/exams.routes.js";

// ... existing imports
import { initWhatsAppClient } from "./services/whatsapp.service.js"; // <-- استيراد الخدمة
import { createWhatsAppRouter } from "./routes/whatsapp.routes.js";
import createAuditLogRouter from "./routes/auditLog.routes.js";
import createGamificationRouter from "./routes/gamification.routes.js"; // ⚡ NEW

// VdoCipher / Watch / Playback Token
import createVdocipherRouter from "./routes/vdocipher.routes.js";
import createWatchRouter from "./routes/watch.routes.js";
import createWatchHomeworkRouter from "./routes/watch-homework.routes.js"; // ⚡ NEW
import createPlaybackTokenRouter from "./routes/playback-token.routes.js";

// Middlewares
import { notFound } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { requireAuth } from "./middlewares/auth.js";
import { requireRole } from "./middlewares/roles.js";

import createStatsRouter from "./routes/stats.routes.js";

export async function initApp(models, modelsMap) {
  const app = express();

  // =====================================
  // 0) مساعدة مسار الملفات (ESM friendly)
  // =====================================
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // ✅ Prefix ثابت للـ API version
  const API_PREFIX = "/api/v1";

  // =====================================
  // 1) CORS – السماح لأي Origin
  // =====================================
 // =====================================
// 1) CORS
// =====================================
const corsOptions = {
  origin: (origin, cb) => {
    cb(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "x-device-id",
    "x-app-version",
    "x-platform",
    "x-player-protocol",
    "X-Player-Protocol",
  ],
  optionsSuccessStatus: 204,
};



  // Swagger
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // لازم يتسجل قبل أي Routes
  app.use(cors(corsOptions));
  // دعم كل طلبات preflight
  app.options("*", cors(corsOptions));

  // =====================================
  // 2) Middlewares أساسية
  // =====================================
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));

  // HLS – هو أصلاً تحت /api/hls فهنسيبه زي ما هو
  app.use("/api/hls", hlsRouter);

  // =====================================
  // 3) ملفات ثابتة (Static)
  // =====================================
  app.use(
    "/uploads",
    express.static(path.join(__dirname, "..", "public", "uploads")),
  );

  // ملفات التحميل للمشغل (Desktop/Mac) - Route مخصص لضمان التحميل المباشر
  // __dirname في ESM يشير إلى src، لذا نرجع مستوى واحد للوصول إلى public
  const downloadsPath = path.join(__dirname, "..", "public", "downloads");

  // Log المسار للتأكد من صحته
  // console.log("[Downloads] Downloads path:", downloadsPath);
  // console.log(
  //   "[Downloads] Downloads path exists:",
  //   fs.existsSync(downloadsPath),
  // );

  // Route لعرض صفحة التحميل الاحترافية
  app.get("/downloads", (req, res) => {
    const fileName = req.query.file || "Etqan_Educational_Player_Installer.exe";
    const downloadPagePath = path.join(downloadsPath, "download.html");

    if (fs.existsSync(downloadPagePath)) {
      res.sendFile(path.resolve(downloadPagePath));
    } else {
      // Fallback: إعادة توجيه مباشر للتحميل
      res.redirect(`/downloads/${fileName}`);
    }
  });

  app.get("/downloads/:fileName", (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(downloadsPath, fileName);

    console.log("[Downloads] Requested file:", fileName);

    // 1. Check if file is HTML - serve it directly
    if (fileName === "download.html" || fileName.endsWith(".html")) {
      if (fs.existsSync(filePath)) {
        return res.sendFile(path.resolve(filePath));
      }
      return res.status(404).send("Not Found");
    }

    // 2. Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log("[Downloads] File not found:", filePath);
      const downloadPagePath = path.join(downloadsPath, "download.html");
      if (fs.existsSync(downloadPagePath)) {
        return res.redirect(
          `/downloads/download.html?error=not_found&file=${encodeURIComponent(fileName)}`,
        );
      }
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // 3. Determine if we should show the download page or start download
    const isDirect = req.query.direct === "true";
    const userAgent = req.headers["user-agent"] || "";
    const acceptHeader = req.headers["accept"] || "";

    // Show download page if:
    // - Not a direct download request
    // - Accept header prefers HTML (browser page visit)
    // - Not a tool like curl/wget
    const shouldShowPage =
      !isDirect &&
      acceptHeader.includes("text/html") &&
      !userAgent.includes("curl") &&
      !userAgent.includes("wget");

    if (shouldShowPage) {
      console.log("[Downloads] Showing download page for:", fileName);
      const downloadPagePath = path.join(downloadsPath, "download.html");
      if (fs.existsSync(downloadPagePath)) {
        return res.redirect(
          `/downloads/download.html?file=${encodeURIComponent(fileName)}`,
        );
      }
    }

    // 4. Perform actual download
    console.log("[Downloads] Starting direct download for:", fileName);

    // Use res.download for robust file serving with correct headers
    res.download(filePath, fileName, (err) => {
      if (err) {
        if (!res.headersSent) {
          console.error("[Downloads] Error during download:", err);
          res
            .status(500)
            .json({ success: false, message: "Error downloading file" });
        } else {
          console.log("[Downloads] Download connection closed or interrupted");
        }
      } else {
        console.log("[Downloads] Download completed successfully:", fileName);
      }
    });
  });

  // Fallback: static middleware للتحميل المباشر
  app.use(
    "/downloads",
    express.static(downloadsPath, {
      setHeaders: (res, filePath) => {
        // إعداد headers للتحميل المباشر
        const fileName = path.basename(filePath);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`,
        );
        res.setHeader("Content-Type", "application/octet-stream");
      },
    }),
  );

  // شهادات
  app.use("/certificates", createCertificatesRouter(models));
  app.use(API_PREFIX + "/certificates", createCertificatesRouter(models));

  // =====================================
  // 4) لوج تشخيصي (Dev)
  // =====================================
  app.use((req, _res, next) => {
    console.log("[REQ]", req.method, req.url, req.body);
    next();
  });
  
  // Games router moved to top to prevent 404 shadowing
  const gamesRouter = createGamesRouter(models);
  app.use("/games", gamesRouter);
  app.use(API_PREFIX + "/games", gamesRouter);

  // =====================================
  // 🔒 Dashboard & Administrative Routes (requireAuth + Role check)
  // =====================================

  // Note: we allow 'user' role here because individual routes inside handle fine-grained admin/user checks
  app.use(API_PREFIX + "/admin/exams", requireAuth, requireRole('admin', 'user'), createAdminExamsRouter(models));
  app.use(API_PREFIX + "/admin/topups", requireAuth, requireRole('admin', 'user'), createAdminTopupsRouter(models));
  
  app.use(API_PREFIX + "/student-insights", requireAuth, requireRole('admin'), createStudentInsightsRouter(models));
  app.use(API_PREFIX + "/stats", requireAuth, requireRole('admin'), createStatsRouter(models));
  app.use(API_PREFIX + "/whatsapp", requireAuth, requireRole('admin'), createWhatsAppRouter(models));
  app.use(API_PREFIX + "/sync", requireAuth, requireRole('admin', 'supervisor'), createSyncRouter(modelsMap));
  app.use(API_PREFIX + "/audit-logs", createAuditLogRouter(models));
  app.use(API_PREFIX + "/gamification", createGamificationRouter(models));

  // =====================================
  // 🔓 Routes with Internal Auth (each file handles its own protection)
  // =====================================
  app.use(API_PREFIX + "/users", createUsersRouter(models));

  // Notifications: student endpoints use requireAuth internally, admin endpoints use requireAuth+requireRole
  app.use(API_PREFIX + "/notifications", createNotificationsRouter(models));

  // Students: register/login are public, /me and admin CRUD are protected internally
  app.use(API_PREFIX + "/students", createStudentsRouter(models));

  // Device Sessions: admin/user can manage student devices
  app.use(API_PREFIX + "/device-sessions", createDeviceSessionsRouter(models));

  // Clients: admin management for leads/clients
  app.use(API_PREFIX + "/clients", createClientsRouter(models));

  // Checkout: each endpoint uses requireAuth internally
  app.use(API_PREFIX + "/checkout", createCheckoutRouter(models));

  // VdoCipher: protected internally
  app.use(API_PREFIX + "/vdocipher", createVdocipherRouter(models));

  // Playback Token: protected internally
  app.use(API_PREFIX + "/playback", createPlaybackTokenRouter(models));

  // =====================================
  // 5) Public & Common Context Routes
  // =====================================

  // App Utilities
  app.use(API_PREFIX + "/app", createAppRouter());

  // Health
  app.use(API_PREFIX + "/health", healthRoutes);

  // Auth (Login / Logout / me)
  app.use(API_PREFIX + "/auth", createAuthRouter(models));

  // Public/Student Content (Keep open or protect partially based on route internal logic)
  app.use(API_PREFIX + "/courses", createCoursesRouter(models));
  app.use(API_PREFIX + "/exams", createExamsRouter(models));
  app.use(API_PREFIX + "/community", createCommunityRouter(models));
  app.use(API_PREFIX + "/centers", createCentersRouter(models));
  app.use(API_PREFIX + "/faq", createFaqRouter(models));
  app.use(API_PREFIX + "/self-quiz", createSelfQuizRouter(models));
  app.use(API_PREFIX + "/map-faq", createMapFaqRouter(models));
  app.use(API_PREFIX + "/plans", createPlansRouter(models));
  app.use(API_PREFIX + "/vouchers", createVouchersRouter(models));
  app.use(API_PREFIX + "/wallet", createWalletRouter(models));
  app.use(API_PREFIX + "/watch", createWatchRouter(models));
  app.use(API_PREFIX + "/watch-homework", createWatchHomeworkRouter(models));
  app.use(API_PREFIX + "/qr-snippets", createQrSnippetsRouter(models));
  app.use(API_PREFIX + "/qr-links", createQrLinksRouter(models));
  app.use(API_PREFIX + "/live-requests", createLiveRequestsRouter(models));
  app.use(API_PREFIX + "/attendance", createAttendanceRouter(models));
  app.use(API_PREFIX + "/center-attendance", createCenterAttendanceRouter(models));
  app.use(API_PREFIX + "/center-attendance-course", createCenterAttendanceCourseRouter(models));
  app.use(API_PREFIX + "/progress", createProgressRouter(models));
  app.use(API_PREFIX + "/student-activity", createStudentActivityRouter(models));
  app.use(API_PREFIX + "/student-homework", createStudentHomeworkRouter(models));

  app.get("/students/me", requireAuth, (req, res) => {
    res.json({ success: true, me: req.user });
  });
  app.get(API_PREFIX + "/students/me", requireAuth, (req, res) => {
    res.json({ success: true, me: req.user });
  });

  // Auth
  // app.use(API_PREFIX + "/auth", createAuthRouter(models)); // Removed duplicate registration

  // =====================================
  // 10) أخطاء
  // =====================================
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
