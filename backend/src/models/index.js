// src/models/index.js
import { getMysql, getSqlite } from "../config/db.js";
import crypto from 'crypto';

// الأساسيات / المستخدمين
import { defineUserModel } from "./user.model.js";
import { defineOutboxModel } from "./outbox.js";
import { defineClientModel } from "./example.client.js";
import { defineStudentModel } from "./student.model.js";
import { defineStudentCertificateModel } from "./student-certificate.model.js";
import { definePasswordResetModel } from "./password-reset.model.js";

// Gamification
import { defineGamificationSettingModel } from "./gamification-setting.model.js";
import { definePointTransactionModel } from "./point-transaction.model.js";

// كورسات/محاضرات
import { defineCourseModel } from "./course.model.js";
import { defineLessonModel } from "./lesson.model.js";

// شراء/اشتراك/وصول
import { definePlanModel } from "./plan.model.js";
import { defineSubscriptionModel } from "./subscription.model.js";
import { defineOrderModel } from "./order.model.js";
import { defineOrderItemModel } from "./order-item.model.js";
import { definePaymentModel } from "./payment.model.js";
import { defineEnrollmentModel } from "./enrollment.model.js";

// المحفظة/الشحن/الفاوتشر
import { defineWalletModel } from "./wallet.model.js";
import { defineWalletTxModel } from "./wallet-tx.model.js";
import { defineTopupModel } from "./topup.model.js";
import { defineVoucherModel } from "./voucher.model.js";
import { defineWhatsappCampaignModel } from "./whatsapp-campaign.model.js";
import { defineWhatsappCampaignLogModel } from "./whatsapp-campaign-log.model.js"; 

// Community
import { defineCommunityQuestionModel } from "./community.question.model.js";
import { defineCommunityAnswerModel } from "./community.answer.model.js";

// FAQ
import { defineFaqModel } from "./faq.model.js";

// Self-Quiz
import { defineSelfQuizChapterModel } from "./selfquiz.chapter.model.js";
import { defineSelfQuizQuestionModel } from "./selfquiz.question.model.js";
import { defineSelfQuizChoiceModel } from "./selfquiz.choice.model.js";
import { defineSelfQuizCompletionModel } from "./selfquiz.completion.model.js";

// Map Bank
import { defineMapBankModel } from "./mapbank.bank.model.js";
import { defineMapBankItemModel } from "./mapbank.item.model.js";

// Device / Centers
import { defineDeviceSessionModel } from "./device-session.model.js";
import { defineCenterModel } from "./center.model.js";

// Attendance / Override / Progress
import { defineStudentAttendanceModel } from "./student-attendance.model.js";
import { defineStudentLessonOverrideModel } from "./student-lesson-override.model.js";
import { defineStudentLessonProgressModel } from "./student-lesson-progress.model.js";

// Exams
import { defineExamModel } from "./exam.model.js";
import { defineExamQuestionModel } from "./exam-question.model.js";
import { defineExamAttemptModel } from "./exam-attempt.model.js";

// Games (Corrected Import from single file)
import { 
  defineTrueFalseQuestionModel, 
  defineMcqRushQuestionModel, 
  defineFastAnswerQuestionModel, 
  defineFlipCardCountryModel, 
  defineFlipCardQuestionModel, 
  defineBattleFriendQuestionModel, 
  defineTeamBattleQuestionModel, 
  defineGameSessionModel 
} from "./games.models.js";

// QR / Snippets
import { defineQrSnippetModel } from "./qr-snippet.model.js";
import { defineStudentQrViewModel } from "./student-qr-view.model.js";

// Notifications
import { defineNotificationModel } from "./notification.model.js";

// Audit
import { defineAuditLogModel } from "./audit-log.model.js";

// Attendance Sessions
import { defineAttendanceSessionModel } from "./attendance-session.model.js";

// Sync Log
import { defineSyncLogModel } from "./sync-log.js";
import { defineSubscriptionConsumptionModel } from "./subscription-consumption.model.js";

// Missing Imports (Added)
import { defineLessonExamScoreModel } from "./lesson-exam-score.model.js";
import { defineLiveSessionRequestModel } from "./live-session-request.model.js";

function createSyncProxy(modelName, sqliteModel, mysqlModel, outboxModel, syncLogModel) {
  const handler = {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);

      // 1. Handle READ operations with failover
      if (['findOne', 'findAll', 'findByPk', 'count', 'describe'].includes(prop)) {
        return async (...args) => {
          try {
            // Try MySQL first
            const result = await mysqlModel[prop](...args);
            
            // If MySQL is reachable but the record is not synced yet, check SQLite
            if (result === null || (Array.isArray(result) && result.length === 0)) {
              const sqliteResult = await sqliteModel[prop](...args);
              if (sqliteResult !== null && (!Array.isArray(sqliteResult) || sqliteResult.length > 0)) {
                return sqliteResult;
              }
            }
            return result;
          } catch (err) {
            // If MySQL fails (connection or bad DB), fallback to SQLite
            if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeAccessDeniedError' || err.message.includes('Unknown database')) {
              console.warn(`[Proxy] MySQL read failed for ${modelName}.${prop}, falling back to SQLite.`);
              return await sqliteModel[prop](...args);
            }
            throw err;
          }
        };
      }

      // 2. Handle WRITE operations with outbox recording
      if (['create', 'update', 'destroy', 'upsert', 'bulkCreate'].includes(prop)) {
        return async (...args) => {
          const op = prop;
          // Strategy: Always write to SQLite first (local master), then record to outbox
          try {
            const result = await sqliteModel[op](...args);
            
            // Record in outbox for background sync to MySQL
            await outboxModel.create({
              operationId: crypto.randomUUID(),
              modelName,
              op: op === 'destroy' ? 'delete' : op,
              payload: {
                data: op === 'create' ? (result.toJSON ? result.toJSON() : result) : ((op === 'update' || op === 'upsert' || op === 'bulkCreate') ? args[0] : null),
                where: (op === 'update' || op === 'destroy') ? (args[1]?.where || args[0]?.where || args[0]) : null
              },
              status: 'PENDING'
            });

            return result;
          } catch (err) {
            console.error(`[Proxy] Local write error on ${modelName}.${op}:`, err);
            throw err;
          }
        };
      }

      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  };
  return new Proxy(sqliteModel, handler);
}

function applyAssociations(models) {
  const {
    User, Student, Center, Lesson, Course, Subscription, Wallet, WalletTx,
    CommunityQuestion, CommunityAnswer, Order, SubscriptionConsumption,
    Exam, WhatsappCampaign, WhatsappCampaignLog, OrderItem, Payment,
    SelfQuizChapter, SelfQuizQuestion, SelfQuizChoice, MapBank, MapBankItem,
    Voucher, Topup, StudentAttendance, QrSnippet, StudentQrView, Enrollment,
    SelfQuizCompletion, StudentLessonOverride, StudentLessonProgress,
    ExamQuestion, ExamAttempt, AttendanceSession, LiveSessionRequest,
    LessonExamScore, GameSession, DeviceSession, Notification,
    GamificationSetting, PointTransaction
  } = models;

  if (!Course) return;

  Course.hasMany(Lesson, { foreignKey: "courseId", as: "lessons" });
  Lesson.belongsTo(Course, { foreignKey: "courseId", as: "course" });

  Lesson.hasMany(Lesson, { foreignKey: "parentLessonId", as: "homeworks" });
  Lesson.belongsTo(Lesson, { foreignKey: "parentLessonId", as: "parentLesson" });

  Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
  OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  Order.hasMany(Payment, { foreignKey: "orderId", as: "payments" });
  Payment.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  Student.hasOne(Wallet, { foreignKey: "studentId", as: "wallet" });
  Wallet.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  Wallet.hasMany(WalletTx, { foreignKey: "walletId", as: "transactions" });
  WalletTx.belongsTo(Wallet, { foreignKey: "walletId", as: "wallet" });

  Student.hasMany(Topup, { foreignKey: "studentId", as: "topups" });
  Topup.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  CommunityQuestion.hasMany(CommunityAnswer, { foreignKey: "questionId", as: "answers" });
  CommunityAnswer.belongsTo(CommunityQuestion, { foreignKey: "questionId", as: "question" });

  Student.hasMany(CommunityQuestion, { foreignKey: "studentId", as: "questions" });
  CommunityQuestion.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  if (LiveSessionRequest) {
    LiveSessionRequest.belongsTo(Student, { foreignKey: "studentId", as: "student" });
  }
  
  CommunityAnswer.belongsTo(User, { foreignKey: "responderId", as: "responder" });

  SelfQuizChapter.hasMany(SelfQuizQuestion, { foreignKey: "chapterId", as: "questions" });
  SelfQuizQuestion.belongsTo(SelfQuizChapter, { foreignKey: "chapterId", as: "chapter" });

  SelfQuizQuestion.hasMany(SelfQuizChoice, { foreignKey: "questionId", as: "choices" });
  SelfQuizChoice.belongsTo(SelfQuizQuestion, { foreignKey: "questionId", as: "question" });

  SelfQuizCompletion.belongsTo(Student, { foreignKey: "studentId", as: "student" });
  Student.hasMany(SelfQuizCompletion, { foreignKey: "studentId", as: "selfQuizCompletions" });

  SelfQuizCompletion.belongsTo(SelfQuizChapter, { foreignKey: "chapterId", as: "chapter" });
  SelfQuizChapter.hasMany(SelfQuizCompletion, { foreignKey: "chapterId", as: "completions" });

  if (LessonExamScore) {
    Student.hasMany(LessonExamScore, { foreignKey: "studentId", as: "lessonExamScores" });
    LessonExamScore.belongsTo(Student, { foreignKey: "studentId", as: "student" });

    Center.hasMany(LessonExamScore, { foreignKey: "centerId", as: "lessonExamScores" });
    LessonExamScore.belongsTo(Center, { foreignKey: "centerId", as: "center" });

    Course.hasMany(LessonExamScore, { foreignKey: "courseId", as: "lessonExamScores" });
    LessonExamScore.belongsTo(Course, { foreignKey: "courseId", as: "course" });

    Lesson.hasMany(LessonExamScore, { foreignKey: "lessonId", as: "examScores" });
    LessonExamScore.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson" });
  }

  WhatsappCampaign.hasMany(WhatsappCampaignLog, { foreignKey: "campaignId", as: "logs" });
  WhatsappCampaignLog.belongsTo(WhatsappCampaign, { foreignKey: "campaignId", as: "campaign" });

  MapBank.hasMany(MapBankItem, { foreignKey: "bankId", as: "items" });
  MapBankItem.belongsTo(MapBank, { foreignKey: "bankId", as: "bank" });

  if (DeviceSession) {
    Student.hasMany(DeviceSession, { foreignKey: "studentId", as: "deviceSessions" });
    DeviceSession.belongsTo(Student, { foreignKey: "studentId", as: "student" });
  }

  Student.belongsTo(Center, { foreignKey: "centerId", as: "center" });
  Center.hasMany(Student, { foreignKey: "centerId", as: "students" });

  if (Notification) {
    Student.hasMany(Notification, { foreignKey: "studentId", as: "notifications" });
    Notification.belongsTo(Student, { foreignKey: "studentId", as: "student" });
  }

  Student.hasMany(StudentAttendance, { foreignKey: "studentId", as: "attendances", constraints: false });
  StudentAttendance.belongsTo(Student, { foreignKey: "studentId", as: "student", constraints: false });

  Voucher.belongsTo(Student, { foreignKey: "redeemedByStudentId", as: "redeemer" });
  Student.hasMany(Voucher, { foreignKey: "redeemedByStudentId", as: "redeemedVouchers" });

  Lesson.hasMany(StudentAttendance, { foreignKey: "lessonId", as: "attendances", constraints: false });
  StudentAttendance.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson", constraints: false });
  StudentAttendance.belongsTo(Course, { foreignKey: "courseId", as: "course", constraints: false });
  StudentAttendance.belongsTo(Center, { foreignKey: "centerId", as: "center", constraints: false });

  Student.hasMany(StudentLessonOverride, { foreignKey: "studentId", as: "lessonOverrides" });
  StudentLessonOverride.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  Lesson.hasMany(StudentLessonOverride, { foreignKey: "lessonId", as: "overrides" });
  StudentLessonOverride.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson" });

  Student.hasMany(StudentLessonProgress, { foreignKey: "studentId", as: "lessonProgress" });
  StudentLessonProgress.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  Lesson.hasMany(StudentLessonProgress, { foreignKey: "lessonId", as: "progress" });
  StudentLessonProgress.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson" });

  Subscription.hasMany(SubscriptionConsumption, { foreignKey: "subscriptionId", as: "consumptions" });
  SubscriptionConsumption.belongsTo(Subscription, { foreignKey: "subscriptionId", as: "subscription" });

  Exam.hasMany(ExamQuestion, { foreignKey: "examId", as: "questions" });
  ExamQuestion.belongsTo(Exam, { foreignKey: "examId", as: "exam" });

  Student.hasMany(ExamAttempt, { foreignKey: "studentId", as: "examAttempts" });
  ExamAttempt.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  Exam.hasMany(ExamAttempt, { foreignKey: "examId", as: "attempts" });
  ExamAttempt.belongsTo(Exam, { foreignKey: "examId", as: "exam" });

  if (GameSession) {
    Student.hasMany(GameSession, { foreignKey: "studentId", as: "gameSessions" });
    GameSession.belongsTo(Student, { foreignKey: "studentId", as: "student" });
  }

  Course.hasMany(QrSnippet, { foreignKey: "courseId", as: "qrSnippets" });
  QrSnippet.belongsTo(Course, { foreignKey: "courseId", as: "course" });

  Lesson.hasMany(QrSnippet, { foreignKey: "lessonId", as: "qrSnippets" });
  QrSnippet.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson" });

  Student.hasMany(StudentQrView, { foreignKey: "studentId", as: "qrViews" });
  StudentQrView.belongsTo(Student, { foreignKey: "studentId", as: "student" });

  Lesson.hasMany(StudentQrView, { foreignKey: "lessonId", as: "qrViews" });
  StudentQrView.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson" });

  Course.hasMany(StudentQrView, { foreignKey: "courseId", as: "qrViews" });
  StudentQrView.belongsTo(Course, { foreignKey: "courseId", as: "course" });

  if (AttendanceSession) {
    Center.hasMany(AttendanceSession, { foreignKey: "centerId", as: "attendanceSessions", constraints: false });
    AttendanceSession.belongsTo(Center, { foreignKey: "centerId", as: "center", constraints: false });

    Course.hasMany(AttendanceSession, { foreignKey: "courseId", as: "attendanceSessions", constraints: false });
    AttendanceSession.belongsTo(Course, { foreignKey: "courseId", as: "course", constraints: false });

    Lesson.hasMany(AttendanceSession, { foreignKey: "lessonId", as: "attendanceSessions", constraints: false });
    AttendanceSession.belongsTo(Lesson, { foreignKey: "lessonId", as: "lesson", constraints: false });
  }

  Enrollment.belongsTo(Course, { foreignKey: "courseId", as: "course", onDelete: "CASCADE" });
  Course.hasMany(Enrollment, { foreignKey: "courseId", as: "enrollments", onDelete: "CASCADE" });

  Enrollment.belongsTo(Student, { foreignKey: "studentId", as: "student", onDelete: "CASCADE" });
  Student.hasMany(Enrollment, { foreignKey: "studentId", as: "enrollments", onDelete: "CASCADE" });

  if (PointTransaction) {
    Student.hasMany(PointTransaction, { foreignKey: "studentId", as: "pointTransactions", constraints: false });
    PointTransaction.belongsTo(Student, { foreignKey: "studentId", as: "student", constraints: false });
  }
}

export function registerModels(sequelize, sqliteParams = null) {
  if (!sequelize) {
    try {
      sequelize = getMysql();
    } catch (e) {
      // If MySQL is down, we use a dummy or skip MySQL definitions if handled by defineOnBoth
    }
  }

  if (!sqliteParams) {
    try {
      sqliteParams = { sequelize: getSqlite() };
    } catch (e) {
      // Handle SQLite missing
    }
  }

  const models = {};
  const sqliteModels = {};

  const defineOnBoth = (name, defineFn, tableName) => {
    models[name] = defineFn(sequelize, tableName);
    if (sqliteParams && sqliteParams.sequelize) {
      sqliteModels[name] = defineFn(sqliteParams.sequelize, tableName);
    }
  };

  // Define models
  defineOnBoth("User", defineUserModel, "users");
  defineOnBoth("Outbox", defineOutboxModel, "outbox");
  defineOnBoth("SyncLog", defineSyncLogModel, "sync_logs");
  defineOnBoth("Client", defineClientModel, "clients");
  defineOnBoth("Student", defineStudentModel, "students");
  defineOnBoth("StudentCertificate", defineStudentCertificateModel, "student_certificates");
  defineOnBoth("PasswordReset", definePasswordResetModel, "password_resets");
  defineOnBoth("GamificationSetting", defineGamificationSettingModel, "gamification_settings");
  defineOnBoth("PointTransaction", definePointTransactionModel, "point_transactions");
  defineOnBoth("Course", defineCourseModel, "courses");
  defineOnBoth("Lesson", defineLessonModel, "lessons");
  defineOnBoth("Plan", definePlanModel, "plans");
  defineOnBoth("Subscription", defineSubscriptionModel, "subscriptions");
  defineOnBoth("Order", defineOrderModel, "orders");
  defineOnBoth("OrderItem", defineOrderItemModel, "order_items");
  defineOnBoth("Payment", definePaymentModel, "payments");
  defineOnBoth("Enrollment", defineEnrollmentModel, "enrollments");
  defineOnBoth("SubscriptionConsumption", defineSubscriptionConsumptionModel, "subscription_consumptions");
  defineOnBoth("Wallet", defineWalletModel, "wallets");
  defineOnBoth("WalletTx", defineWalletTxModel, "wallet_txs");
  defineOnBoth("Topup", defineTopupModel, "topups");
  defineOnBoth("Voucher", defineVoucherModel, "vouchers");
  defineOnBoth("WhatsappCampaign", defineWhatsappCampaignModel, "whatsapp_campaigns");
  defineOnBoth("WhatsappCampaignLog", defineWhatsappCampaignLogModel, "whatsapp_campaign_logs");
  defineOnBoth("CommunityQuestion", defineCommunityQuestionModel, "community_questions");
  defineOnBoth("CommunityAnswer", defineCommunityAnswerModel, "community_answers");
  defineOnBoth("Faq", defineFaqModel, "faq_items");
  defineOnBoth("SelfQuizChapter", defineSelfQuizChapterModel, "selfquiz_chapters");
  defineOnBoth("SelfQuizQuestion", defineSelfQuizQuestionModel, "selfquiz_questions");
  defineOnBoth("SelfQuizChoice", defineSelfQuizChoiceModel, "selfquiz_choices");
  defineOnBoth("SelfQuizCompletion", defineSelfQuizCompletionModel, "selfquiz_completions");
  defineOnBoth("MapBank", defineMapBankModel, "map_banks");
  defineOnBoth("MapBankItem", defineMapBankItemModel, "map_bank_items");
  defineOnBoth("DeviceSession", defineDeviceSessionModel, "device_sessions");
  defineOnBoth("Center", defineCenterModel, "centers");
  defineOnBoth("StudentAttendance", defineStudentAttendanceModel, "student_attendance");
  defineOnBoth("StudentLessonOverride", defineStudentLessonOverrideModel, "student_lesson_overrides");
  defineOnBoth("StudentLessonProgress", defineStudentLessonProgressModel, "student_lesson_progress");
  defineOnBoth("Exam", defineExamModel, "exams");
  defineOnBoth("ExamQuestion", defineExamQuestionModel, "exam_questions");
  defineOnBoth("ExamAttempt", defineExamAttemptModel, "exam_attempts");
  defineOnBoth("TrueFalseQuestion", defineTrueFalseQuestionModel);
  defineOnBoth("McqRushQuestion", defineMcqRushQuestionModel);
  defineOnBoth("FastAnswerQuestion", defineFastAnswerQuestionModel);
  defineOnBoth("FlipCardCountry", defineFlipCardCountryModel);
  defineOnBoth("FlipCardQuestion", defineFlipCardQuestionModel);
  defineOnBoth("BattleFriendQuestion", defineBattleFriendQuestionModel);
  defineOnBoth("TeamBattleQuestion", defineTeamBattleQuestionModel);
  defineOnBoth("GameSession", defineGameSessionModel);
  defineOnBoth("LessonExamScore", defineLessonExamScoreModel, "lesson_exam_scores");
  defineOnBoth("QrSnippet", defineQrSnippetModel, "qr_snippets");
  defineOnBoth("StudentQrView", defineStudentQrViewModel, "student_qr_views");
  defineOnBoth("Notification", defineNotificationModel, "notifications");
  defineOnBoth("AuditLog", defineAuditLogModel, "audit_logs");
  defineOnBoth("AttendanceSession", defineAttendanceSessionModel, "attendance_sessions");
  defineOnBoth("LiveSessionRequest", defineLiveSessionRequestModel, "live_session_requests");

  // Apply associations
  applyAssociations(models);
  if (sqliteParams && sqliteParams.sequelize) {
    applyAssociations(sqliteModels);
  }

  // Wrap with sync proxy
  const syncModels = {};
  const outboxModel = sqliteModels["Outbox"] || models["Outbox"];
  const syncLogModel = sqliteModels["SyncLog"] || models["SyncLog"];

  Object.keys(models).forEach(name => {
    if (name === 'Outbox' || name === 'SyncLog') {
      syncModels[name] = sqliteModels[name] || models[name];
      return;
    }

    if (sqliteModels[name]) {
      syncModels[name] = createSyncProxy(name, sqliteModels[name], models[name], outboxModel, syncLogModel);
    } else {
      syncModels[name] = models[name];
    }
  });

  // Prepare result with suffixes for stores.js
  const result = {
    sequelize,
    sqliteSequelize: sqliteParams ? sqliteParams.sequelize : null,
    ...syncModels,
    raw: {
      mysql: models,
      sqlite: sqliteModels
    }
  };

  // Add suffixed versions for stores.js destructuring
  Object.keys(models).forEach(name => {
    result[`${name}Mysql`] = models[name];
    if (sqliteModels[name]) {
      result[`${name}Sqlite`] = sqliteModels[name];
    }
  });

  return result;
}
