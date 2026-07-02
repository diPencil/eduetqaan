import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import {
  getClientStatus,
  sendDirectMessage,
  startCampaignService,
  initWhatsAppClient,
  logoutWhatsAppClient,
} from "../services/whatsapp.service.js";

export function createWhatsAppRouter(models) {
  const router = Router();

  const {
    Student,
    WhatsappCampaign,
    StudentAttendance,
    Lesson,
    Center,
    WhatsappCampaignLog,
  } = models;

  // =========================
  // Helpers
  // =========================
  const pickLevelField = (model) => {
    // يدعم level أو year حسب الداتابيز/الموديل
    if (!model?.rawAttributes) return null;
    if (model.rawAttributes.level) return "level";
    if (model.rawAttributes.year) return "year";
    return null;
  };

  const STUDENT_LEVEL_FIELD = pickLevelField(Student);
  const LESSON_LEVEL_FIELD = pickLevelField(Lesson);

  const normalizeTemplate = (tpl = "") => {
    if (!tpl || typeof tpl !== "string") return tpl;
    // احتياطي: لو حد كتب {name} بالغلط
    return tpl
      .replaceAll("{name}", "{{name}}")
      .replaceAll("{code}", "{{code}}")
      .replaceAll("{center}", "{{center}}")
      .replaceAll("{level}", "{{level}}");
  };

  const phoneWhere = {
    [Op.not]: null,
    [Op.ne]: "",
  };

  // ==========================================
  // 1) init
  // ==========================================
  router.post("/init", requireAuth, (req, res) => {
    try {
      initWhatsAppClient();
      res.json({ success: true, message: "جاري فتح متصفح الواتساب..." });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 2) status
  // ==========================================
  router.get("/status", requireAuth, (req, res) => {
    const status = getClientStatus();
    res.json({ success: true, data: status });
  });

  // ==========================================
  // 3) send direct
  // ==========================================
  router.post("/send", requireAuth, async (req, res) => {
    try {
      const { phone, message } = req.body;
      await sendDirectMessage(phone, message);
      res.json({ success: true, message: "Message sent" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 4) create/start campaign
  // ==========================================
  router.post("/campaign", requireAuth, async (req, res) => {
    try {
      const {
        targetType,
        filters, // { level, centerId }
        lessonId,
        specificCodes,
        messageTemplate,
        title,
        batchSize,
        batchDelay,
      } = req.body;

      const normalizedTemplate = normalizeTemplate(messageTemplate);

      let students = [];
      let targetDetailsData = {};

      console.log("🚀 Starting Campaign Request:", { targetType, filters });

      // ---------------------------
      // A) FILTERS
      // ---------------------------
      if (targetType === "FILTERS") {
        const whereClause = {};

        console.log("🔥 Filters from FE:", filters);

        // level (preferred) or year (compat)
        const levelValue = filters?.level ?? filters?.year;
        if (levelValue && STUDENT_LEVEL_FIELD) {
          whereClause[STUDENT_LEVEL_FIELD] = String(levelValue);
        }

        if (filters?.centerId) {
          whereClause.centerId = Number(filters.centerId);
        }

        whereClause.studentPhone = phoneWhere;

        console.log("🔍 Final whereClause:", whereClause);

        students = await Student.findAll({
          where: whereClause,
          attributes: ["id", "studentName", "studentPhone", "centerCode", "centerName"],
        });

        console.log(`📊 Found students: ${students.length}`);

        targetDetailsData = { ...filters, level: levelValue };
      }

      // ---------------------------
      // B) ATTENDANCE / ABSENT_ATTENDANCE
      // ---------------------------
      else if (targetType === "ATTENDANCE" || targetType === "ABSENT_ATTENDANCE") {
        if (!lessonId) {
          return res.status(400).json({ success: false, message: "يجب تحديد المحاضرة (lessonId)" });
        }

        const isAbsent = targetType === "ABSENT_ATTENDANCE";
        const centerId = filters?.centerId ? Number(filters.centerId) : null;

        // level required from FE (عشان تمييز الدروس) — لكن هنحاول نستنتجه لو Lesson عنده level
        let levelValue = filters?.level ?? filters?.year;

        if (!levelValue && Lesson && LESSON_LEVEL_FIELD) {
          const lessonRow = await Lesson.findByPk(Number(lessonId), {
            attributes: [LESSON_LEVEL_FIELD],
          });
          if (lessonRow?.[LESSON_LEVEL_FIELD]) levelValue = lessonRow[LESSON_LEVEL_FIELD];
        }

        // لو عايز تخليه "إجباري" 100% حتى لو ممكن استنتاجه:
        // if (!levelValue) return res.status(400).json({ success: false, message: "اختر السنة الدراسية (level) أولاً" });

        const attendanceWhere = { lessonId: Number(lessonId) };
        if (centerId) attendanceWhere.centerId = centerId;

        const attendees = await StudentAttendance.findAll({
          where: attendanceWhere,
          attributes: ["studentId"],
        });

        const attendeeIds = attendees.map((a) => a.studentId);

        if (!isAbsent && attendeeIds.length === 0) {
          return res.status(404).json({
            success: false,
            message: "لم يحضر أحد هذه المحاضرة بالمواصفات المحددة",
          });
        }

        // Eligible students by level(+center) + phone
        const studentWhere = {
          studentPhone: phoneWhere,
        };

        if (centerId) studentWhere.centerId = centerId;
        if (levelValue && STUDENT_LEVEL_FIELD) studentWhere[STUDENT_LEVEL_FIELD] = String(levelValue);

        if (!isAbsent) {
          // حضور: فقط الحاضرين
          studentWhere.id = { [Op.in]: attendeeIds };
        } else {
          // غياب: كل المؤهلين - الحاضرين
          if (attendeeIds.length > 0) {
            studentWhere.id = { [Op.notIn]: attendeeIds };
          }
          // لو مفيش حاضرين: يبقى كل المؤهلين غياب (نترك شرط id بدون notIn)
        }

        students = await Student.findAll({
          where: studentWhere,
          attributes: ["id", "studentName", "studentPhone", "centerCode", "centerName"],
        });

        targetDetailsData = {
          lessonId: Number(lessonId),
          centerId: centerId || null,
          level: levelValue || null,
          mode: isAbsent ? "ABSENT" : "ATTENDED",
          totalFound: students.length,
        };
      }

      // ---------------------------
      // C) SPECIFIC_CODES
      // ---------------------------
      else if (targetType === "SPECIFIC_CODES") {
        if (!specificCodes) {
          return res.status(400).json({ success: false, message: "لا توجد أكواد" });
        }

        let codesArray = [];
        if (typeof specificCodes === "string") {
          codesArray = specificCodes
            .split(/[\n,]+/)
            .map((c) => c.trim())
            .filter((c) => c);
        } else if (Array.isArray(specificCodes)) {
          codesArray = specificCodes.map(String).map((c) => c.trim()).filter(Boolean);
        }

        students = await Student.findAll({
          where: {
            centerCode: { [Op.in]: codesArray },
            studentPhone: phoneWhere,
          },
          attributes: ["id", "studentName", "studentPhone", "centerCode", "centerName"],
        });

        targetDetailsData = { requestedCodes: codesArray.length, foundStudents: students.length };
      }

      console.log(`✅ Final students count: ${students?.length || 0}`);

      if (!students || students.length === 0) {
        return res.status(404).json({
          success: false,
          message: "لا يوجد طلاب مطابقين لمعايير البحث (تأكد من وجود أرقام هواتف)",
        });
      }

      // Create campaign row
      let newCampaign = null;
      if (WhatsappCampaign) {
        newCampaign = await WhatsappCampaign.create({
          title: title || `Campaign (${targetType})`,
          messageTemplate: normalizedTemplate,
          targetType,
          targetDetails: targetDetailsData,
          totalTargeted: students.length,
          batchSize: Number(batchSize) || 5,
          batchDelay: Number(batchDelay) || 10,
          status: "PENDING",
          triggeredBy: req.user ? req.user.id : null,
          createdAtLocal: new Date(),
        });
      }

      // Start service
      startCampaignService(
        students,
        normalizedTemplate,
        newCampaign,
        {
          batchSize: Number(batchSize) || 5,
          batchDelay: Number(batchDelay) || 10,
        },
        WhatsappCampaignLog
      );

      res.json({
        success: true,
        message: `تم بدء الحملة لـ ${students.length} طالب`,
        campaignId: newCampaign ? newCampaign.id : null,
      });
    } catch (error) {
      console.error("❌ Campaign Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 5) lessons list (supports ?level=...)
  // ==========================================
  router.get("/lessons-list", requireAuth, async (req, res) => {
    try {
      if (!Lesson) return res.json({ success: true, data: [] });

      const levelQ = (req.query.level ?? req.query.year ?? "").toString().trim();

      const where = {};
      if (levelQ && LESSON_LEVEL_FIELD) {
        where[LESSON_LEVEL_FIELD] = levelQ;
      }

      const attrs = ["id", "title"];
      if (LESSON_LEVEL_FIELD) attrs.push(LESSON_LEVEL_FIELD);

      const lessons = await Lesson.findAll({
        where,
        attributes: attrs,
        limit: 200,
        order: [["id", "DESC"]],
      });

      res.json({ success: true, data: lessons });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 6) centers list
  // ==========================================
  router.get("/centers-list", requireAuth, async (req, res) => {
    try {
      if (!Center) return res.json({ success: true, data: [] });
      const centers = await Center.findAll({
        where: { isDeleted: false },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      });
      res.json({ success: true, data: centers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 7) campaigns archive
  // ==========================================
  router.get("/campaigns", requireAuth, async (req, res) => {
    try {
      if (!WhatsappCampaign) return res.json({ success: true, data: [] });
      const campaigns = await WhatsappCampaign.findAll({
        order: [["createdAt", "DESC"]],
        limit: 50,
      });
      res.json({ success: true, data: campaigns });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 8) campaign logs
  // ==========================================
  router.get("/campaigns/:id/logs", requireAuth, async (req, res) => {
    try {
      if (!WhatsappCampaignLog) return res.json({ success: true, data: [] });

      const campaignId = req.params.id;
      const logs = await WhatsappCampaignLog.findAll({
        where: { campaignId },
        order: [["id", "ASC"]],
      });
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 9) delete campaign
  // ==========================================
  router.delete("/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      if (WhatsappCampaignLog) {
        await WhatsappCampaignLog.destroy({ where: { campaignId: id } });
      }

      if (!WhatsappCampaign) {
        return res.status(404).json({ success: false, message: "Campaign model not available" });
      }

      console.log(`🗑️ Deleting campaign ID: ${id}`);
      const deleted = await WhatsappCampaign.destroy({ where: { id } });

      if (deleted) {
        res.json({ success: true, message: "تم حذف الحملة وسجلاتها بنجاح." });
      } else {
        res.status(404).json({ success: false, message: "الحملة غير موجودة." });
      }
    } catch (error) {
      console.error("❌ Delete Campaign Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 10) logout
  // ==========================================
  router.post("/logout", requireAuth, async (req, res) => {
    try {
      await logoutWhatsAppClient();
      res.json({ success: true, message: "تم تسجيل الخروج بنجاح. يرجى البدء من جديد." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
