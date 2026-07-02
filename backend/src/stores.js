// src/stores.js
import { isMysqlUp } from "./config/db.js";

/**
 * buildModelsMap:
 * يأخذ الموديلات المسجلة ويقوم ببناء الخريطة للمزامنة تلقائياً.
 * 
 * @param {object} models - ما يرجع من registerModels()
 */
export function buildModelsMap(models) {
  const {
    ClientSqlite, ClientMysql,
    UserSqlite, UserMysql,
    CenterSqlite, CenterMysql,
    StudentSqlite, StudentMysql,
    PlanSqlite, PlanMysql,
    WalletSqlite, WalletMysql,
    WalletTxSqlite, WalletTxMysql,
    TopupSqlite, TopupMysql,
    VoucherSqlite, VoucherMysql,
    NotificationSqlite, NotificationMysql,
    StudentAttendanceSqlite, StudentAttendanceMysql,
    StudentLessonProgressSqlite, StudentLessonProgressMysql,
    QrSnippetSqlite, QrSnippetMysql,
    StudentQrViewSqlite, StudentQrViewMysql,
    ExamSqlite, ExamMysql,
    ExamQuestionSqlite, ExamQuestionMysql,
    ExamAttemptSqlite, ExamAttemptMysql,
    StudentCertificateSqlite, StudentCertificateMysql,
    OutboxSqlite, SyncLogSqlite
  } = models;

  return {
    Client: { sqliteModel: ClientSqlite, mysqlModel: ClientMysql },
    User: { sqliteModel: UserSqlite, mysqlModel: UserMysql },
    Center: { sqliteModel: CenterSqlite, mysqlModel: CenterMysql },
    Student: { sqliteModel: StudentSqlite, mysqlModel: StudentMysql },
    Plan: { sqliteModel: PlanSqlite, mysqlModel: PlanMysql },
    Wallet: { sqliteModel: WalletSqlite, mysqlModel: WalletMysql },
    WalletTx: { sqliteModel: WalletTxSqlite, mysqlModel: WalletTxMysql },
    TopupRequest: { sqliteModel: TopupSqlite, mysqlModel: TopupMysql },
    Voucher: { sqliteModel: VoucherSqlite, mysqlModel: VoucherMysql },

    Notification: {
      sqliteModel: NotificationSqlite,
      mysqlModel: NotificationMysql,
    },

    // 🔴 نفس اسم modelName اللي بتبعته في performOperation
    StudentAttendance: {
      sqliteModel: StudentAttendanceSqlite,
      mysqlModel: StudentAttendanceMysql,
    },
    StudentLessonProgress: {
      sqliteModel: StudentLessonProgressSqlite,
      mysqlModel: StudentLessonProgressMysql,
    },
    QrSnippet: {
      sqliteModel: QrSnippetSqlite,
      mysqlModel: QrSnippetMysql,
    },
    StudentQrView: {
      sqliteModel: StudentQrViewSqlite,
      mysqlModel: StudentQrViewMysql,
    },
    Exam: {
      sqliteModel: ExamSqlite,
      mysqlModel: ExamMysql,
    },
    ExamQuestion: {
      sqliteModel: ExamQuestionSqlite,
      mysqlModel: ExamQuestionMysql,
    },
    ExamAttempt: {
      sqliteModel: ExamAttemptSqlite,
      mysqlModel: ExamAttemptMysql,
    },
    StudentCertificate: {
      sqliteModel: StudentCertificateSqlite,
      mysqlModel: StudentCertificateMysql,
    },
    LiveSessionRequest: {
      sqliteModel: models.LiveSessionRequestSqlite,
      mysqlModel:  models.LiveSessionRequestMysql,
    },
    Faq: {
      sqliteModel: models.FaqSqlite,
      mysqlModel:  models.FaqMysql,
    },
    MapBank: {
      sqliteModel: models.MapBankSqlite,
      mysqlModel:  models.MapBankMysql,
    },
    MapBankItem: {
      sqliteModel: models.MapBankItemSqlite,
      mysqlModel:  models.MapBankItemMysql,
    },

    __helpers: {
      Outbox: OutboxSqlite,
      SyncLog: SyncLogSqlite,
      isMysqlUp,
    },
  };
}
