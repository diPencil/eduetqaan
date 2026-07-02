import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

export function createGamificationRouter(models) {
  const router = Router();
  const { GamificationSetting } = models;

  // GET /api/v1/gamification/settings
  router.get(
    "/settings",
    requireAuth,
    requireRole("admin", "supervisor"),
    async (req, res, next) => {
      try {
        if (!GamificationSetting) {
          return res.status(500).json({ success: false, message: "GamificationSetting model not defined" });
        }
        
        // Find or create default settings
        let settings = await GamificationSetting.findOne();
        if (!settings) {
          settings = await GamificationSetting.create({});
        }

        return res.json({ success: true, data: settings });
      } catch (e) {
        next(e);
      }
    }
  );

  // PATCH /api/v1/gamification/settings
  router.patch(
    "/settings",
    requireAuth,
    requireRole("admin"),
    async (req, res, next) => {
      try {
        if (!GamificationSetting) {
          return res.status(500).json({ success: false, message: "GamificationSetting model not defined" });
        }

        let settings = await GamificationSetting.findOne();
        if (!settings) {
          settings = await GamificationSetting.create({});
        }

        const allowedFields = [
          "isActive",
          "pointsPerEgp",
          "pointsForFullMark",
          "pointsForVideoComplete",
          "pointsForAttendance",
          "pointToEgpRatio"
        ];

        const updates = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }
        updates.updatedAtLocal = new Date();

        await settings.update(updates);

        return res.json({ success: true, message: "تم تحديث إعدادات المكافآت بنجاح", data: settings });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}

export default createGamificationRouter;
