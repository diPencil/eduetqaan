// src/routes/games.routes.js
import { Router } from "express";
import { fn, col, literal } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";



/**
 * @swagger
 * tags:
 *   - name: Games
 *     description: ألعاب التفاعل التعليمية (صح/غلط، MCQ Rush، Fast Answer، Flip Card، Battle Friend، XP & Leaderboard)
 *
 * components:
 *   schemas:
 *     GameTrueFalseQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         text:
 *           type: string
 *         isTrue:
 *           type: boolean
 *         level:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     GameMcqQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         text:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         correctIndex:
 *           type: integer
 *         level:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     GameFlipCountry:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         flagEmoji:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     GameFlipQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         countryId:
 *           type: integer
 *         text:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         correctIndex:
 *           type: integer
 *         level:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     BattleFriendQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         text:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         correctIndex:
 *           type: integer
 *         level:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *
 *     BattleFriendRoomState:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         playerSlot:
 *           type: string
 *           description: 'p1 أو p2'
 *         currentPlayerSlot:
 *           type: string
 *         currentQuestionIndex:
 *           type: integer
 *         totalQuestions:
 *           type: integer
 *         myScore:
 *           type: integer
 *         friendScore:
 *           type: integer
 *         finished:
 *           type: boolean
 *         turnDurationSec:
 *           type: integer
 *         remainingTime:
 *           type: integer
 *         isYourTurn:
 *           type: boolean
 *         turnStarted:
 *           type: boolean
 *         currentQuestion:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             text:
 *               type: string
 *             options:
 *               type: array
 *               items:
 *                 type: string
 *             correctIndex:
 *               type: integer
 *
 *     GameResultCreateRequest:
 *       type: object
 *       required:
 *         - gameKey
 *         - xp
 *       properties:
 *         gameKey:
 *           type: string
 *           description: مفتاح اللعبة (مثلاً true-false, mcq-rush, fast-answer,...)
 *         xp:
 *           type: integer
 *         score:
 *           type: integer
 *         meta:
 *           type: object
 *           additionalProperties: true
 *
 *     GameLeaderboardEntry:
 *       type: object
 *       properties:
 *         rank:
 *           type: integer
 *         studentId:
 *           type: integer
 *         name:
 *           type: string
 *         centerName:
 *           type: string
 *           nullable: true
 *         level:
 *           type: string
 *           nullable: true
 *         totalXp:
 *           type: integer
 *         gamesCount:
 *           type: integer
 */

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
}

function normalizeOptions(v) {
  if (Array.isArray(v)) {
    return v.map(x => String(x ?? "").trim()).filter(Boolean);
  }

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];

    // JSON string
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map(x => String(x ?? "").trim()).filter(Boolean);
        }
      } catch { }
    }

    // fallback: "a|b|c|d"
    if (s.includes("|")) {
      return s.split("|").map(x => x.trim()).filter(Boolean);
    }

    // fallback: "a,b,c,d"
    if (s.includes(",")) {
      return s.split(",").map(x => x.trim()).filter(Boolean);
    }

    return [];
  }

  return [];
}


function clampCorrectIndex(ci, options) {
  const idx = toInt(ci, 0);
  if (!Array.isArray(options) || options.length === 0) return 0;
  if (idx < 0) return 0;
  if (idx >= options.length) return options.length - 1;
  return idx;
}

// ====== BATTLE FRIEND ROOMS (in-memory) ======
const battleRooms = new Map();
const ROOM_TTL_MS = 60 * 60 * 1000; // ساعة

function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

function getBattleRoomRaw(code) {
  const c = normalizeRoomCode(code);
  const room = battleRooms.get(c);
  if (!room) return null;

  // لو الغرفة عدّى عليها وقت كتير نمسحها
  if (Date.now() - room.createdAt > ROOM_TTL_MS) {
    battleRooms.delete(c);
    return null;
  }
  return room;
}

function getRemainingTime(room) {
  if (!room.turnStartedAt) return room.turnDurationSec;
  const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
  const left = room.turnDurationSec - elapsed;
  return left > 0 ? left : 0;
}

function getBattleRoom(code) {
  const room = getBattleRoomRaw(code);
  if (!room) return null;

  // لو الوقت خلص واحنا لسه ماحدّثناش الدور
  const left = getRemainingTime(room);
  if (room.turnStartedAt && left <= 0 && !room.finished) {
    // الدور القديم خلص
    room.turnStartedAt = null;

    if (room.currentQuestionIndex < room.questions.length - 1) {
      // روح للسؤال اللي بعده وادّي الدور لصاحبك
      room.currentQuestionIndex += 1;
      room.currentPlayerSlot = room.currentPlayerSlot === "p1" ? "p2" : "p1";

      // ابدأ تايمر الدور الجديد أوتوماتيك
      room.turnStartedAt = Date.now();
    } else {
      // مفيش أسئلة تاني → الماتش خلص
      room.finished = true;
    }
  }

  return room;
}

function getPlayerSlot(room, studentId) {
  if (!room) return null;
  if (room.players.p1 && room.players.p1.studentId === studentId) return "p1";
  if (room.players.p2 && room.players.p2.studentId === studentId) return "p2";
  return null;
}

function serializeRoomForPlayer(room, slot, extra = {}) {
  const yourScore =
    slot === "p1"
      ? room.players.p1.score
      : room.players.p2
        ? room.players.p2.score
        : 0;

  const friendScore =
    slot === "p1"
      ? room.players.p2
        ? room.players.p2.score
        : 0
      : room.players.p1.score;

  const currentQuestion = room.questions[room.currentQuestionIndex] || null;
  const remainingTime = getRemainingTime(room);

  return {
    code: room.code,
    playerSlot: slot, // 'p1' أو 'p2'
    currentPlayerSlot: room.currentPlayerSlot,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    myScore: yourScore,
    friendScore,
    finished: room.finished,
    turnDurationSec: room.turnDurationSec,
    remainingTime,
    isYourTurn: !room.finished && room.currentPlayerSlot === slot,
    turnStarted: !!room.turnStartedAt,
    currentQuestion: currentQuestion
      ? {
        id: currentQuestion.id,
        text: currentQuestion.text,
        options: normalizeOptions(currentQuestion.options),
        correctIndex: currentQuestion.correctIndex,
      }
      : null,
    ...extra,
  };
}

// ====== TEAM BATTLE ROOMS (2v2 .. 5v5) ======
const teamBattleRooms = new Map();
const TEAM_BATTLE_MIN_PLAYERS = 2;
const TEAM_BATTLE_MAX_PLAYERS = 5;

function normalizeTeamKey(team) {
  const t = String(team || "").trim().toLowerCase();
  if (["a", "team-a", "team_a", "t1", "1"].includes(t)) return "a";
  if (["b", "team-b", "team_b", "t2", "2"].includes(t)) return "b";
  return null;
}

function getTeamBattleRoomRaw(code) {
  const c = normalizeRoomCode(code);
  const room = teamBattleRooms.get(c);
  if (!room) return null;

  if (Date.now() - room.createdAt > ROOM_TTL_MS) {
    teamBattleRooms.delete(c);
    return null;
  }

  return room;
}

function getTeamBattleRemainingTime(room) {
  return getRemainingTime(room);
}

function getTeamBattleCurrentTeamMemberIds(room) {
  const members = room?.teams?.[room?.currentTeam]?.members || [];
  return members
    .map((m) => Number(m?.studentId))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function ensureTeamBattleTurnState(room) {
  if (!room || typeof room !== "object") return;

  if (!Array.isArray(room.currentTurnExpectedMembers)) {
    room.currentTurnExpectedMembers = [];
  }

  if (
    !room.currentTurnAnswered ||
    typeof room.currentTurnAnswered !== "object" ||
    Array.isArray(room.currentTurnAnswered)
  ) {
    room.currentTurnAnswered = {};
  }

  if (room.turnStartedAt && room.currentTurnExpectedMembers.length === 0) {
    room.currentTurnExpectedMembers = getTeamBattleCurrentTeamMemberIds(room);
  }
}

function resetTeamBattleTurnProgress(room) {
  room.currentTurnExpectedMembers = [];
  room.currentTurnAnswered = {};
}

function getTeamBattleTurnRequiredCount(room) {
  ensureTeamBattleTurnState(room);
  return room.currentTurnExpectedMembers.length;
}

function getTeamBattleTurnAnsweredCount(room) {
  ensureTeamBattleTurnState(room);

  if (!room.currentTurnExpectedMembers.length) return 0;

  const expected = new Set(room.currentTurnExpectedMembers.map((id) => String(id)));
  let answered = 0;

  for (const sid of Object.keys(room.currentTurnAnswered || {})) {
    if (expected.has(String(sid))) answered += 1;
  }

  return answered;
}

function hasTeamBattleMemberAnsweredCurrentTurn(room, studentId) {
  ensureTeamBattleTurnState(room);
  const id = Number(studentId);
  if (!Number.isFinite(id) || id <= 0) return false;
  return !!room.currentTurnAnswered[String(id)];
}

function isTeamBattleMemberExpectedCurrentTurn(room, studentId) {
  ensureTeamBattleTurnState(room);
  const id = Number(studentId);
  if (!Number.isFinite(id) || id <= 0) return false;
  return room.currentTurnExpectedMembers.includes(id);
}

function startTeamBattleTurn(room) {
  ensureTeamBattleTurnState(room);
  room.currentTurnExpectedMembers = getTeamBattleCurrentTeamMemberIds(room);
  room.currentTurnAnswered = {};
  room.turnStartedAt = Date.now();
}

function advanceTeamBattleTurn(room) {
  room.turnStartedAt = null;
  resetTeamBattleTurnProgress(room);

  if (room.currentQuestionIndex < room.questions.length - 1) {
    room.currentQuestionIndex += 1;
    room.currentTeam = room.currentTeam === "a" ? "b" : "a";

    if (isTeamBattleReady(room)) {
      startTeamBattleTurn(room);
    }
    return;
  }

  room.finished = true;
}

function isTeamBattleReady(room) {
  const a = room?.teams?.a?.members?.length || 0;
  const b = room?.teams?.b?.members?.length || 0;
  return a >= TEAM_BATTLE_MIN_PLAYERS && b >= TEAM_BATTLE_MIN_PLAYERS;
}

function getTeamBattleMemberTeam(room, studentId) {
  if (!room || !studentId) return null;

  if (room.teams.a.members.some((m) => m.studentId === studentId)) return "a";
  if (room.teams.b.members.some((m) => m.studentId === studentId)) return "b";
  return null;
}

function getTeamBattleMember(room, studentId) {
  const team = getTeamBattleMemberTeam(room, studentId);
  if (!team) return null;
  return room.teams[team].members.find((m) => m.studentId === studentId) || null;
}

function getTeamScore(room, teamKey) {
  const members = room?.teams?.[teamKey]?.members || [];
  return members.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
}

function getTeamBattleRoom(code) {
  const room = getTeamBattleRoomRaw(code);
  if (!room) return null;
  ensureTeamBattleTurnState(room);
  return room;
}

function serializeTeamBattleRoomForPlayer(room, studentId, extra = {}) {
  ensureTeamBattleTurnState(room);

  const myTeam = getTeamBattleMemberTeam(room, studentId);
  const otherTeam = myTeam === "a" ? "b" : "a";
  const myMember = getTeamBattleMember(room, studentId);

  const teamAScore = getTeamScore(room, "a");
  const teamBScore = getTeamScore(room, "b");
  const currentQuestion = room.questions[room.currentQuestionIndex] || null;
  const remainingTime = getTeamBattleRemainingTime(room);
  const currentTurnAnsweredCount = getTeamBattleTurnAnsweredCount(room);
  const currentTurnRequiredCount = getTeamBattleTurnRequiredCount(room);
  const currentTurnPendingCount = Math.max(
    currentTurnRequiredCount - currentTurnAnsweredCount,
    0
  );
  const myAnsweredCurrentTurn = hasTeamBattleMemberAnsweredCurrentTurn(
    room,
    studentId
  );
  const myExpectedCurrentTurn = isTeamBattleMemberExpectedCurrentTurn(
    room,
    studentId
  );

  return {
    code: room.code,
    myTeam,
    currentTeam: room.currentTeam,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    teamAScore,
    teamBScore,
    myTeamScore: myTeam ? getTeamScore(room, myTeam) : 0,
    opponentTeamScore: myTeam ? getTeamScore(room, otherTeam) : 0,
    myPlayerScore: Number(myMember?.score || 0),
    finished: room.finished,
    turnDurationSec: room.turnDurationSec,
    remainingTime,
    isYourTurn: !!myTeam && !room.finished && room.currentTeam === myTeam,
    turnStarted: !!room.turnStartedAt,
    teamAPlayers: room.teams.a.members.length,
    teamBPlayers: room.teams.b.members.length,
    minPlayersPerTeam: TEAM_BATTLE_MIN_PLAYERS,
    maxPlayersPerTeam: TEAM_BATTLE_MAX_PLAYERS,
    canStart: isTeamBattleReady(room),
    currentTurnAnsweredCount,
    currentTurnRequiredCount,
    currentTurnPendingCount,
    myAnsweredCurrentTurn,
    myExpectedCurrentTurn,
    currentQuestion: currentQuestion
      ? {
        id: currentQuestion.id,
        text: currentQuestion.text,
        options: normalizeOptions(currentQuestion.options),
        correctIndex: currentQuestion.correctIndex,
      }
      : null,
    ...extra,
  };
}

export default function createGamesRouter(models) {
  // console.log('[Games] Initializing games router factory...');
  const router = Router();

  // Debug log for troubleshooting 404s
  router.use((req, _res, next) => {
    console.log(`[Games Router] Incoming: ${req.method} ${req.url}`);
    next();
  });
  // console.log('[Games] Router internal logger registered.');

  const {
    // ممكن بعضهم يبقى undefined حسب التسمية الفعلية
    TrueFalseQuestionMysql,
    TrueFalseQuestion,

    McqRushQuestionMysql,
    McqRushQuestion,

    FastAnswerQuestionMysql,
    FastAnswerQuestion,

    FlipCardCountryMysql,
    FlipCardCountry,

    FlipCardQuestionMysql,
    FlipCardQuestion,

    BattleFriendQuestionMysql,
    BattleFriendQuestion,

    TeamBattleQuestionMysql,
    TeamBattleQuestion,

    GameSessionMysql,
    GameSession,

    StudentMysql,
    Student,
  } = models;

  // موديلات موحّدة تدعم كل التسميات المحتملة
  const TrueFalseQuestionModel =
    TrueFalseQuestionMysql ||
    TrueFalseQuestion ||
    models.TrueFalseQuestionMysql ||
    models.TrueFalseQuestion ||
    null;

  const McqRushQuestionModel =
    McqRushQuestionMysql ||
    McqRushQuestion ||
    models.McqRushQuestionMysql ||
    models.McqRushQuestion ||
    null;

  const FastAnswerQuestionModel =
    FastAnswerQuestionMysql ||
    FastAnswerQuestion ||
    models.FastAnswerQuestionMysql ||
    models.FastAnswerQuestion ||
    null;

  const FlipCardCountryModel =
    FlipCardCountryMysql ||
    FlipCardCountry ||
    models.FlipCardCountryMysql ||
    models.FlipCardCountry ||
    null;

  const FlipCardQuestionModel =
    FlipCardQuestionMysql ||
    FlipCardQuestion ||
    models.FlipCardQuestionMysql ||
    models.FlipCardQuestion ||
    null;

  const BattleFriendQuestionModel =
    BattleFriendQuestionMysql ||
    BattleFriendQuestion ||
    models.BattleFriendQuestionMysql ||
    models.BattleFriendQuestion ||
    null;

  const TeamBattleQuestionModel =
    TeamBattleQuestionMysql ||
    TeamBattleQuestion ||
    models.TeamBattleQuestionMysql ||
    models.TeamBattleQuestion ||
    null;

  const GameSessionModel =
    GameSessionMysql ||
    GameSession ||
    models.GameSessionMysql ||
    models.GameSession ||
    null;

  const StudentModel =
    StudentMysql || Student || models.StudentMysql || models.Student || null;

  // هنا اخترت أخلي الألعاب الأساسية مطلوبة
  if (!TrueFalseQuestionModel) {
    throw new Error(
      "TrueFalseQuestion model (TrueFalseQuestion / TrueFalseQuestionMysql) is not configured"
    );
  }
  if (!McqRushQuestionModel) {
    throw new Error(
      "McqRushQuestion model (McqRushQuestion / McqRushQuestionMysql) is not configured"
    );
  }
  if (!FastAnswerQuestionModel) {
    throw new Error(
      "FastAnswerQuestion model (FastAnswerQuestion / FastAnswerQuestionMysql) is not configured"
    );
  }
  if (!FlipCardCountryModel || !FlipCardQuestionModel) {
    throw new Error(
      "FlipCard models (FlipCardCountry / FlipCardCountryMysql, FlipCardQuestion / FlipCardQuestionMysql) are not configured"
    );
  }
  if (!BattleFriendQuestionModel) {
    throw new Error(
      "BattleFriendQuestion model (BattleFriendQuestion / BattleFriendQuestionMysql) is not configured"
    );
  }
  if (!TeamBattleQuestionModel) {
    throw new Error(
      "TeamBattleQuestion model (TeamBattleQuestion / TeamBattleQuestionMysql) is not configured"
    );
  }
  if (!GameSessionModel || !StudentModel) {
    throw new Error(
      "GameSession / Student models are not configured for games leaderboard and XP"
    );
  }

  // نستخدم sequelize من الـ models أو من أي موديل ألعاب متوفر
  const sequelize =
    models.sequelize ||
    TrueFalseQuestionModel?.sequelize ||
    McqRushQuestionModel?.sequelize ||
    FastAnswerQuestionModel?.sequelize ||
    FlipCardQuestionModel?.sequelize ||
    BattleFriendQuestionModel?.sequelize ||
    TeamBattleQuestionModel?.sequelize ||
    GameSessionModel?.sequelize;

  if (!sequelize) {
    throw new Error("Sequelize instance not found for games routes");
  }

  // إعدادات لعبة الصح والغلط (in-memory)
  let trueFalseSettings = {
    active: true,
    baseXpPerStreak: 10,
  };

  /* =========================================
     TRUE / FALSE GAME (صح ولا غلط)
     GET /games/true-false/questions  (للطلاب)
     ========================================= */

  /**
   * @swagger
   * /games/true-false/questions:
   *   get:
   *     summary: جلب أسئلة لعبة صح/غلط عشوائية للطالب
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *         description: مستوى/سنة الطالب (اختياري)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: عدد الأسئلة المطلوبة
   *     responses:
   *       200:
   *         description: قائمة أسئلة صح/غلط
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/GameTrueFalseQuestion'
   */
  router.get("/true-false/questions", requireAuth,
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 20;
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
            ? Math.round(limitRaw)
            : 20;

        const where = { isActive: true };
        if (level) where["level"] = level;

        const rows = await TrueFalseQuestionModel.findAll({
          where,
          order: [sequelize.random()],
          limit,
        });

        const data = rows.map((r) => ({
          id: r.id,
          text: r.text,
          isTrue: r.isTrue,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    });

  /* -------- BULK INSERT: TRUE / FALSE (استيراد جماعي) -------- */

  /**
   * @swagger
   * /games/true-false/questions/bulk:
   *   post:
   *     summary: استيراد جماعي لأسئلة صح/غلط (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: array
   *                 items:
   *                   $ref: '#/components/schemas/GameTrueFalseQuestion'
   *               - type: object
   *                 properties:
   *                   questions:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/GameTrueFalseQuestion'
   *     responses:
   *       200:
   *         description: تم استيراد الأسئلة
   *       400:
   *         description: بيانات غير صالحة
   *       403:
   *         description: يتطلب صلاحية أدمن
   */
  router.post(
    "/true-false/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((q) => ({
            text: String(q.text || "").trim(),
            isTrue: Boolean(q.isTrue),
            level: q.level ? String(q.level).trim() : null,
            isActive: q.isActive === false ? false : true,
          }))
          .filter((q) => q.text);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الأسئلة فاضية أو مش صحيحة",
          });
        }

        const created = await TrueFalseQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          text: r.text,
          isTrue: r.isTrue,
          level: r.level ?? null,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     TRUE / FALSE ADMIN (Settings + CRUD)
     ========================================= */

  /**
   * @swagger
   * /games/true-false/admin/settings:
   *   get:
   *     summary: جلب إعدادات لعبة صح/غلط
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: إعدادات اللعبة
   */
  router.get(
    "/true-false/admin/settings",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        res.json({ success: true, data: trueFalseSettings });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/true-false/admin/settings:
   *   post:
   *     summary: تحديث إعدادات لعبة صح/غلط
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               active:
   *                 type: boolean
   *               baseXpPerStreak:
   *                 type: integer
   *     responses:
   *       200:
   *         description: تم تحديث الإعدادات
   *       400:
   *         description: بيانات غير صالحة
   */
  router.post(
    "/true-false/admin/settings",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};

        if (body.baseXpPerStreak !== undefined) {
          const v = Number(body.baseXpPerStreak);
          if (!Number.isFinite(v) || v <= 0) {
            return res.status(400).json({
              success: false,
              message: "baseXpPerStreak لازم يكون رقم أكبر من 0",
            });
          }
          trueFalseSettings.baseXpPerStreak = Math.round(v);
        }

        if (body.active !== undefined) {
          trueFalseSettings.active = !!body.active;
        }

        res.json({ success: true, data: trueFalseSettings });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/true-false/admin/questions:
   *   get:
   *     summary: قائمة أسئلة صح/غلط (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/true-false/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const rows = await TrueFalseQuestionModel.findAll({
          order: [["id", "DESC"]],
        });

        const data = rows.map((r) => ({
          id: r.id,
          text: r.text,
          isTrue: r.isTrue,
          level: r.level ?? null,
          isActive: r.isActive,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/true-false/admin/questions:
   *   post:
   *     summary: إضافة سؤال صح/غلط واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameTrueFalseQuestion'
   *     responses:
   *       200:
   *         description: تم إنشاء السؤال
   *       400:
   *         description: بيانات غير صالحة
   */
  router.post(
    "/true-false/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const text = String(body.text || "").trim();

        let isTrue = body.isTrue;
        if (typeof isTrue === "string") {
          isTrue = isTrue === "true";
        } else {
          isTrue = !!isTrue;
        }

        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3) {
          return res.status(400).json({
            success: false,
            message: "نص التصريح مطلوب (٣ أحرف على الأقل)",
          });
        }

        const created = await TrueFalseQuestionModel.create({
          text,
          isTrue,
          level,
          isActive,
        });

        const data = {
          id: created.id,
          text: created.text,
          isTrue: created.isTrue,
          level: created.level ?? null,
          isActive: created.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/true-false/admin/questions/{id}:
   *   put:
   *     summary: تعديل سؤال صح/غلط
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameTrueFalseQuestion'
   *     responses:
   *       200:
   *         description: تم التعديل
   *       400:
   *         description: بيانات غير صالحة
   *       404:
   *         description: السؤال غير موجود
   */
  router.put(
    "/true-false/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await TrueFalseQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص التصريح مطلوب (٣ أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.isTrue !== undefined) {
          let isTrue = body.isTrue;
          if (typeof isTrue === "string") {
            isTrue = isTrue === "true";
          } else {
            isTrue = !!isTrue;
          }
          patch.isTrue = isTrue;
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await TrueFalseQuestionModel.findByPk(id);
        const data = {
          id: fresh.id,
          text: fresh.text,
          isTrue: fresh.isTrue,
          level: fresh.level ?? null,
          isActive: fresh.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/true-false/admin/questions/{id}:
   *   delete:
   *     summary: حذف سؤال صح/غلط
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم الحذف
   *       404:
   *         description: السؤال غير موجود
   */
  router.delete(
    "/true-false/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await TrueFalseQuestionModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     MCQ RUSH GAME
     ========================================= */

  /**
   * @swagger
   * /games/mcq-rush/questions:
   *   get:
   *     summary: جلب أسئلة MCQ Rush عشوائية
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: قائمة أسئلة MCQ Rush
   */
  router.get("/mcq-rush/questions", requireAuth,
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 10;
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50
            ? Math.round(limitRaw)
            : 10;

        const where = { isActive: true };
        if (level) where["level"] = level;

        const rows = await McqRushQuestionModel.findAll({
          where,
          order: [sequelize.random()],
          limit,
        });

        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
          };
        });

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    });

  /**
   * @swagger
   * /games/mcq-rush/questions/bulk:
   *   post:
   *     summary: استيراد جماعي لأسئلة MCQ Rush
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: array
   *                 items:
   *                   $ref: '#/components/schemas/GameMcqQuestion'
   *               - type: object
   *                 properties:
   *                   questions:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم الاستيراد
   */
  router.post(
    "/mcq-rush/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((q) => {
            const options = Array.isArray(q.options) ? q.options : [];
            return {
              text: String(q.text || "").trim(),
              options,
              correctIndex: toInt(q.correctIndex, 0),
              level: q.level ? String(q.level).trim() : null,
              isActive: q.isActive === false ? false : true,
            };
          })
          .filter((q) => q.text && q.options.length >= 2);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الأسئلة فاضية أو مافيهاش options كفاية",
          });
        }

        const created = await McqRushQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          text: r.text,
          options: Array.isArray(r.options) ? r.options : [],
          correctIndex: r.correctIndex,
          level: r.level ?? null,
          isActive: r.isActive,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/mcq-rush/admin/questions:
   *   post:
   *     summary: إضافة سؤال MCQ Rush واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم الإنشاء
   */
  router.post(
    "/mcq-rush/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const text = String(body.text || "").trim();
        const rawOptions = Array.isArray(body.options) ? body.options : [];
        const options = rawOptions.map(o => String(o || "").trim()).filter(o => o.length > 0);
        let correctIndex = toInt(body.correctIndex, 0);
        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3 || options.length < 2) {
          return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
        }
        if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

        const created = await McqRushQuestionModel.create({ text, options, correctIndex, level, isActive });
        res.json({ success: true, data: created });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/mcq-rush/admin/questions:
   *   get:
   *     summary: قائمة أسئلة MCQ Rush (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/mcq-rush/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 100;

        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500
            ? Math.round(limitRaw)
            : 100;

        const where = {};
        if (level) where["level"] = level;

        const rows = await McqRushQuestionModel.findAll({
          where,
          order: [["id", "DESC"]],
          limit,
        });

        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
            level: r.level ?? null,
            isActive: !!r.isActive,
          };
        });

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );


  /**
   * @swagger
   * /games/mcq-rush/admin/questions/{id}:
   *   put:
   *     summary: تعديل سؤال MCQ Rush
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم التعديل
   */
  router.put(
    "/mcq-rush/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await McqRushQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.options !== undefined) {
          const raw = Array.isArray(body.options) ? body.options : [];
          const opts = raw
            .map((o) => String(o || "").trim())
            .filter((o) => o.length > 0);

          if (opts.length < 2) {
            return res.status(400).json({
              success: false,
              message: "لازم يكون فيه اختيارين على الأقل",
            });
          }

          patch.options = opts;
        }

        if (body.correctIndex !== undefined) {
          let ci = toInt(body.correctIndex, 0);
          const opts = patch.options
            ? patch.options
            : Array.isArray(row.options)
              ? row.options
              : [];

          if (!opts.length || ci < 0 || ci >= opts.length) {
            ci = 0;
          }
          patch.correctIndex = ci;
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await McqRushQuestionModel.findByPk(id);
        const data = {
          id: fresh.id,
          text: fresh.text,
          options: Array.isArray(fresh.options) ? fresh.options : [],
          correctIndex: fresh.correctIndex,
          level: fresh.level ?? null,
          isActive: fresh.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/mcq-rush/admin/questions/{id}:
   *   delete:
   *     summary: حذف سؤال MCQ Rush
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم الحذف
   */
  router.delete(
    "/mcq-rush/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await McqRushQuestionModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     FAST ANSWER GAME
     ========================================= */

  /**
   * @swagger
   * /games/fast-answer/questions:
   *   get:
   *     summary: جلب أسئلة لعبة أسرع إجابة
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 5
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get("/fast-answer/questions", requireAuth, async (req, res, next) => {
    try {
      const level = String(req.query.level || "").trim() || null;
      const limitRaw =
        req.query.limit !== undefined ? Number(req.query.limit) : 5;
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 20
          ? Math.round(limitRaw)
          : 5;

      const where = { isActive: true };
      if (level) where["level"] = level;

      const rows = await FastAnswerQuestionModel.findAll({
        where,
        order: [sequelize.random()],
        limit,
      });

      const data = rows.map((r) => {
        const options = normalizeOptions(r.options);
        return {
          id: r.id,
          text: r.text,
          options,
          correctIndex: clampCorrectIndex(r.correctIndex, options),
        };
      });


      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /games/fast-answer/questions/bulk:
   *   post:
   *     summary: استيراد جماعي لأسئلة أسرع إجابة
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: array
   *                 items:
   *                   $ref: '#/components/schemas/GameMcqQuestion'
   *               - type: object
   *                 properties:
   *                   questions:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم الاستيراد
   */
  router.post(
    "/fast-answer/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((q) => {
            const options = Array.isArray(q.options) ? q.options : [];
            return {
              text: String(q.text || "").trim(),
              options,
              correctIndex: toInt(q.correctIndex, 0),
              level: q.level ? String(q.level).trim() : null,
              isActive: q.isActive === false ? false : true,
            };
          })
          .filter((q) => q.text && q.options.length >= 2);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الأسئلة فاضية أو مافيهاش options كفاية",
          });
        }

        const created = await FastAnswerQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          text: r.text,
          options: Array.isArray(r.options) ? r.options : [],
          correctIndex: r.correctIndex,
          level: r.level ?? null,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/fast-answer/admin/questions:
   *   get:
   *     summary: قائمة أسئلة أسرع إجابة (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/fast-answer/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 100;

        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500
            ? Math.round(limitRaw)
            : 100;

        const where = {};
        if (level) where["level"] = level;

        const rows = await FastAnswerQuestionModel.findAll({
          where,
          order: [["id", "DESC"]],
          limit,
        });

        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
            level: r.level ?? null,
            isActive: !!r.isActive,
          };
        });

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );


  /**
   * @swagger
   * /games/fast-answer/admin/questions:
   *   post:
   *     summary: إضافة سؤال أسرع إجابة واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم إنشاء السؤال
   */
  router.post(
    "/fast-answer/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const text = String(body.text || "").trim();
        const rawOptions = Array.isArray(body.options) ? body.options : [];
        const options = rawOptions.map(o => String(o || "").trim()).filter(o => o.length > 0);
        let correctIndex = toInt(body.correctIndex, 0);
        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3 || options.length < 2) {
          return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
        }
        if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

        const created = await FastAnswerQuestionModel.create({ text, options, correctIndex, level, isActive });
        res.json({ success: true, data: created });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/fast-answer/admin/questions/{id}:
   *   put:
   *     summary: تعديل سؤال أسرع إجابة
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameMcqQuestion'
   *     responses:
   *       200:
   *         description: تم التعديل
   */
  router.put(
    "/fast-answer/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await FastAnswerQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.options !== undefined) {
          const raw = Array.isArray(body.options) ? body.options : [];
          const opts = raw
            .map((o) => String(o || "").trim())
            .filter((o) => o.length > 0);

          if (opts.length < 2) {
            return res.status(400).json({
              success: false,
              message: "لازم يكون فيه اختيارين على الأقل",
            });
          }

          patch.options = opts;
        }

        if (body.correctIndex !== undefined) {
          let ci = toInt(body.correctIndex, 0);
          const opts = patch.options
            ? patch.options
            : Array.isArray(row.options)
              ? row.options
              : [];

          if (!opts.length || ci < 0 || ci >= opts.length) {
            ci = 0;
          }
          patch.correctIndex = ci;
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await FastAnswerQuestionModel.findByPk(id);
        const data = {
          id: fresh.id,
          text: fresh.text,
          options: Array.isArray(fresh.options) ? fresh.options : [],
          correctIndex: fresh.correctIndex,
          level: fresh.level ?? null,
          isActive: fresh.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/fast-answer/admin/questions/{id}:
   *   delete:
   *     summary: حذف سؤال أسرع إجابة
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم الحذف
   */
  router.delete(
    "/fast-answer/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await FastAnswerQuestionModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     FLIP THE CARD GAME
     ========================================= */

  /**
   * @swagger
   * /games/flip-card/countries:
   *   get:
   *     summary: قائمة الدول المتاحة في لعبة Flip Card (للطلبة)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الدول
   */
  router.get("/flip-card/countries", requireAuth, async (req, res, next) => {
    try {
      const rows = await FlipCardCountryModel.findAll({
        where: { isActive: true },
        order: [["name", "ASC"]],
      });

      const data = rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        flagEmoji: r.flagEmoji,
      }));

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /games/flip-card/countries/bulk:
   *   post:
   *     summary: استيراد جماعي للدول (Flip Card) - أدمن
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: array
   *                 items:
   *                   $ref: '#/components/schemas/GameFlipCountry'
   *               - type: object
   *                 properties:
   *                   countries:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/GameFlipCountry'
   *     responses:
   *       200:
   *         description: تم الاستيراد
   */
  router.post(
    "/flip-card/countries/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.countries)
            ? req.body.countries
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "countries[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((c) => ({
            code: String(c.code || "").trim().toUpperCase(),
            name: String(c.name || "").trim(),
            flagEmoji: c.flagEmoji ? String(c.flagEmoji).trim() : null,
            isActive: c.isActive === false ? false : true,
          }))
          .filter((c) => c.code && c.name);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الدول فاضية أو من غير code/name",
          });
        }

        const created = await FlipCardCountryModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          flagEmoji: r.flagEmoji,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/questions:
   *   get:
   *     summary: جلب أسئلة دولة معيّنة (Flip Card) للطالب
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: countryId
   *         schema:
   *           type: integer
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 5
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get("/flip-card/questions", requireAuth, async (req, res, next) => {
    try {
      const countryIdRaw =
        req.query.countryId !== undefined ? Number(req.query.countryId) : NaN;
      const code = String(req.query.code || "").trim();

      let countryId = Number.isFinite(countryIdRaw) ? countryIdRaw : null;

      if (!countryId && code) {
        const c = await FlipCardCountryModel.findOne({
          where: { code, isActive: true },
        });
        if (!c) {
          return res.status(404).json({
            success: false,
            message: "الدولة غير موجودة",
          });
        }
        countryId = c.id;
      }

      if (!countryId) {
        return res.status(400).json({
          success: false,
          message: "countryId أو code مطلوب",
        });
      }

      const limitRaw =
        req.query.limit !== undefined ? Number(req.query.limit) : 5;
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 20
          ? Math.round(limitRaw)
          : 5;

      const rows = await FlipCardQuestionModel.findAll({
        where: { isActive: true, countryId },
        order: [sequelize.random()],
        limit,
      });
      const data = rows.map((r) => {
        const options = normalizeOptions(r.options);
        return {
          id: r.id,
          text: r.text,
          options,
          correctIndex: clampCorrectIndex(r.correctIndex, options),
        };
      });


      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /games/flip-card/questions/bulk:
   *   post:
   *     summary: استيراد جماعي لأسئلة Flip Card (لكل الدول)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               questions:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/GameFlipQuestion'
   *     responses:
   *       200:
   *         description: تم الاستيراد
   */
  router.post(
    "/flip-card/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const countries = await FlipCardCountryModel.findAll({
          where: { isActive: true },
        });
        const byCode = new Map(
          countries.map((c) => [String(c.code).toUpperCase(), c.id])
        );
        const byId = new Set(countries.map((c) => c.id));

        const payload = [];

        for (const q of list) {
          let countryId = Number.isFinite(Number(q.countryId))
            ? Number(q.countryId)
            : null;

          if (!countryId && q.countryCode) {
            const cid = byCode.get(String(q.countryCode).toUpperCase());
            if (cid) countryId = cid;
          }

          const text = String(q.text || "").trim();
          const options = Array.isArray(q.options) ? q.options : [];
          const correctIndex = toInt(q.correctIndex, 0);

          if (!countryId || !byId.has(countryId)) continue;
          if (!text || options.length < 2) continue;

          payload.push({
            countryId,
            text,
            options,
            correctIndex,
            isActive: q.isActive === false ? false : true,
          });
        }

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message:
              "مفيش سؤال صالح (راجع countryId / countryCode و text / options)",
          });
        }

        const created = await FlipCardQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          countryId: r.countryId,
          text: r.text,
          options: Array.isArray(r.options) ? r.options : [],
          correctIndex: r.correctIndex,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     FLIP CARD ADMIN (Countries + Questions)
     ========================================= */

  /**
   * @swagger
   * /games/flip-card/admin/countries:
   *   get:
   *     summary: قائمة الدول (Flip Card) للأدمن
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الدول
   */
  router.get(
    "/flip-card/admin/countries",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const rows = await FlipCardCountryModel.findAll({
          order: [["name", "ASC"]],
        });

        const data = rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          flagEmoji: r.flagEmoji,
          isActive: r.isActive,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/countries:
   *   post:
   *     summary: إضافة دولة واحدة (Flip Card)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameFlipCountry'
   *     responses:
   *       200:
   *         description: تم الإنشاء
   */
  router.post(
    "/flip-card/admin/countries",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};

        const name = String(body.name || "").trim();
        const code = String(body.code || "").trim().toUpperCase();
        const flagEmoji = body.flagEmoji ? String(body.flagEmoji).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!name || !code) {
          return res.status(400).json({
            success: false,
            message: "name و code مطلوبين",
          });
        }

        const created = await FlipCardCountryModel.create({
          name,
          code,
          flagEmoji,
          isActive,
        });

        const data = {
          id: created.id,
          code: created.code,
          name: created.name,
          flagEmoji: created.flagEmoji,
          isActive: created.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/countries/{id}:
   *   put:
   *     summary: تعديل دولة (Flip Card)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم التعديل
   */
  router.put(
    "/flip-card/admin/countries/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await FlipCardCountryModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "الدولة غير موجودة" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.name !== undefined) {
          const name = String(body.name || "").trim();
          if (!name) {
            return res
              .status(400)
              .json({ success: false, message: "name مطلوب" });
          }
          patch.name = name;
        }

        if (body.code !== undefined) {
          const code = String(body.code || "").trim().toUpperCase();
          if (!code) {
            return res
              .status(400)
              .json({ success: false, message: "code مطلوب" });
          }
          patch.code = code;
        }

        if (body.flagEmoji !== undefined) {
          patch.flagEmoji = body.flagEmoji
            ? String(body.flagEmoji).trim()
            : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await FlipCardCountryModel.findByPk(id);
        const data = {
          id: fresh.id,
          code: fresh.code,
          name: fresh.name,
          flagEmoji: fresh.flagEmoji,
          isActive: fresh.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/countries/{id}:
   *   delete:
   *     summary: حذف دولة (Flip Card)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   */
  router.delete(
    "/flip-card/admin/countries/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await FlipCardCountryModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/questions:
   *   get:
   *     summary: قائمة أسئلة Flip Card لدولة معيّنة (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: countryId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 200
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/flip-card/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const countryIdRaw =
          req.query.countryId !== undefined ? Number(req.query.countryId) : NaN;
        const countryId = Number.isFinite(countryIdRaw) ? countryIdRaw : null;

        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 200;

        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500
            ? Math.round(limitRaw)
            : 200;

        const where = {};
        if (countryId) {
          where.countryId = countryId;
        }

        const level = String(req.query.level || "").trim() || null;
        if (level) {
          where.level = level;
        }

        const rows = await FlipCardQuestionModel.findAll({
          where,
          order: [["id", "DESC"]],
          limit,
        });

        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            countryId: r.countryId,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
            level: r.level ?? null,
            isActive: !!r.isActive,
          };
        });

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/questions:
   *   post:
   *     summary: إضافة سؤال Flip Card واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameFlipQuestion'
   *     responses:
   *       200:
   *         description: تم الإنشاء
   */
  router.post(
    "/flip-card/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};

        const countryId = Number(body.countryId);
        if (!countryId) {
          return res
            .status(400)
            .json({ success: false, message: "countryId مطلوب" });
        }

        const country = await FlipCardCountryModel.findByPk(countryId);
        if (!country) {
          return res
            .status(404)
            .json({ success: false, message: "الدولة غير موجودة" });
        }

        const text = String(body.text || "").trim();
        const rawOptions = Array.isArray(body.options) ? body.options : [];
        const options = rawOptions
          .map((o) => String(o || "").trim())
          .filter((o) => o.length > 0);

        let correctIndex = toInt(body.correctIndex, 0);
        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3) {
          return res.status(400).json({
            success: false,
            message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
          });
        }

        if (options.length < 2) {
          return res.status(400).json({
            success: false,
            message: "لازم يكون فيه اختيارين على الأقل",
          });
        }

        if (correctIndex < 0 || correctIndex >= options.length) {
          correctIndex = 0;
        }

        const created = await FlipCardQuestionModel.create({
          countryId,
          text,
          options,
          correctIndex,
          level,
          isActive,
        });

        const data = {
          id: created.id,
          countryId: created.countryId,
          text: created.text,
          options: Array.isArray(created.options) ? created.options : [],
          correctIndex: created.correctIndex,
          level: created.level ?? null,
          isActive: created.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/questions/{id}:
   *   put:
   *     summary: تعديل سؤال Flip Card
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم التعديل
   */
  router.put(
    "/flip-card/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await FlipCardQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.countryId !== undefined) {
          const cid = Number(body.countryId);
          if (!cid) {
            return res
              .status(400)
              .json({ success: false, message: "countryId غير صالح" });
          }
          const country = await FlipCardCountryModel.findByPk(cid);
          if (!country) {
            return res
              .status(404)
              .json({ success: false, message: "الدولة غير موجودة" });
          }
          patch.countryId = cid;
        }

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.options !== undefined) {
          const raw = Array.isArray(body.options) ? body.options : [];
          const opts = raw
            .map((o) => String(o || "").trim())
            .filter((o) => o.length > 0);

          if (opts.length < 2) {
            return res.status(400).json({
              success: false,
              message: "لازم يكون فيه اختيارين على الأقل",
            });
          }

          patch.options = opts;
        }

        if (body.correctIndex !== undefined) {
          let ci = toInt(body.correctIndex, 0);

          const opts = patch.options
            ? patch.options
            : Array.isArray(row.options)
              ? row.options
              : [];

          if (!opts.length || ci < 0 || ci >= opts.length) {
            ci = 0;
          }
          patch.correctIndex = ci;
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await FlipCardQuestionModel.findByPk(id);
        const data = {
          id: fresh.id,
          countryId: fresh.countryId,
          text: fresh.text,
          options: Array.isArray(fresh.options) ? fresh.options : [],
          correctIndex: fresh.correctIndex,
          level: fresh.level ?? null,
          isActive: fresh.isActive,
        };

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/flip-card/admin/questions/{id}:
   *   delete:
   *     summary: حذف سؤال Flip Card
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم الحذف
   */
  router.delete(
    "/flip-card/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await FlipCardQuestionModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     BATTLE FRIEND GAME + ADMIN
     ========================================= */

  /**
   * @swagger
   * /games/battle-friend/admin/questions:
   *   get:
   *     summary: قائمة أسئلة Battle Friend (أدمن)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/battle-friend/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 200;
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500
            ? Math.round(limitRaw)
            : 200;

        const where = {};
        if (level) where["level"] = level;

        const rows = await BattleFriendQuestionModel.findAll({
          where,
          order: [["id", "DESC"]],
          limit,
        });

        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
            level: r.level ?? null,
            isActive: r.isActive,
          };
        });


        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/admin/questions:
   *   post:
   *     summary: إضافة سؤال Battle Friend واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BattleFriendQuestion'
   *     responses:
   *       200:
   *         description: تم الإنشاء
   */
  router.post(
    "/battle-friend/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};

        const text = String(body.text || "").trim();

        const rawOptions = Array.isArray(body.options) ? body.options : [];
        const options = rawOptions
          .map((o) => String(o || "").trim())
          .filter((o) => o.length > 0);

        let correctIndex = toInt(body.correctIndex, 0);
        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3) {
          return res.status(400).json({
            success: false,
            message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
          });
        }

        if (options.length < 2) {
          return res.status(400).json({
            success: false,
            message: "لازم يكون فيه اختيارين على الأقل",
          });
        }

        if (correctIndex < 0 || correctIndex >= options.length) {
          correctIndex = 0;
        }

        const created = await BattleFriendQuestionModel.create({
          text,
          options,
          correctIndex,
          level,
          isActive,
        });

        const optionsOut = normalizeOptions(created.options);
        const data = {
          id: created.id,
          text: created.text,
          options: optionsOut,
          correctIndex: clampCorrectIndex(created.correctIndex, optionsOut),
          level: created.level ?? null,
          isActive: created.isActive,
        };


        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/admin/questions/{id}:
   *   put:
   *     summary: تعديل سؤال Battle Friend
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم التعديل
   */
  router.put(
    "/battle-friend/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        const row = await BattleFriendQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص السؤال مطلوب (٣ أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.options !== undefined) {
          const raw = Array.isArray(body.options) ? body.options : [];
          const opts = raw
            .map((o) => String(o || "").trim())
            .filter((o) => o.length > 0);

          if (opts.length < 2) {
            return res.status(400).json({
              success: false,
              message: "لازم يكون فيه اختيارين على الأقل",
            });
          }

          patch.options = opts;
        }

        if (body.correctIndex !== undefined) {
          let ci = toInt(body.correctIndex, 0);

          const opts = patch.options ? patch.options : normalizeOptions(row.options);


          if (!opts.length || ci < 0 || ci >= opts.length) {
            ci = 0;
          }
          patch.correctIndex = ci;
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();

        await row.update(patch);

        const fresh = await BattleFriendQuestionModel.findByPk(id);
        const optionsOut = normalizeOptions(fresh.options);
        const data = {
          id: fresh.id,
          text: fresh.text,
          options: optionsOut,
          correctIndex: clampCorrectIndex(fresh.correctIndex, optionsOut),
          level: fresh.level ?? null,
          isActive: fresh.isActive,
        };


        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/admin/questions/{id}:
   *   delete:
   *     summary: حذف سؤال Battle Friend
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: تم الحذف
   */
  router.delete(
    "/battle-friend/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID غير صالح" });
        }

        await BattleFriendQuestionModel.destroy({ where: { id } });

        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/questions:
   *   get:
   *     summary: جلب أسئلة Battle Friend عشوائية للطالب (بدون غرف)
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: level
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 5
   *     responses:
   *       200:
   *         description: قائمة الأسئلة
   */
  router.get(
    "/battle-friend/questions",
    requireAuth,
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const limitRaw =
          req.query.limit !== undefined ? Number(req.query.limit) : 5;
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 20
            ? Math.round(limitRaw)
            : 5;

        const where = { isActive: true };
        if (level) where["level"] = level;

        const rows = await BattleFriendQuestionModel.findAll({
          where,
          order: [sequelize.random()],
          limit,
        });
        const data = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
          };
        });


        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/questions/bulk:
   *   post:
   *     summary: استيراد جماعي لأسئلة Battle Friend
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               questions:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/BattleFriendQuestion'
   *     responses:
   *       200:
   *         description: تم الاستيراد
   */
  router.post(
    "/battle-friend/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((q) => {
            const options = Array.isArray(q.options) ? q.options : [];
            return {
              text: String(q.text || "").trim(),
              options,
              correctIndex: toInt(q.correctIndex, 0),
              level: q.level ? String(q.level).trim() : null,
              isActive: q.isActive === false ? false : true,
            };
          })
          .filter((q) => q.text && q.options.length >= 2);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الأسئلة فاضية أو مافيهاش options كفاية",
          });
        }

        const created = await BattleFriendQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        const data = created.map((r) => ({
          id: r.id,
          text: r.text,
          options: Array.isArray(r.options) ? r.options : [],
          correctIndex: r.correctIndex,
          level: r.level ?? null,
        }));

        res.json({ success: true, data });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/room:
   *   post:
   *     summary: إنشاء أو الانضمام لغرفة Battle Friend
   *     description: |
   *       - mode=create لإنشاء غرفة جديدة مع أسئلة عشوائية  
   *       - mode=join للانضمام لغرفة موجودة بنفس الكود
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               mode:
   *                 type: string
   *                 enum: [create, join]
   *               code:
   *                 type: string
   *               questionsCount:
   *                 type: integer
   *               level:
   *                 type: string
   *     responses:
   *       200:
   *         description: حالة الغرفة بعد الدخول
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/BattleFriendRoomState'
   */
  router.post(
    "/battle-friend/room",
    requireAuth,
    async (req, res, next) => {
      try {
        const { mode, code, questionsCount, level } = req.body || {};
        const studentId = Number(req.user?.id);

        if (!studentId) {
          return res
            .status(401)
            .json({ success: false, message: "مطلوب تسجيل الدخول" });
        }

        const roomMode = String(mode || "").trim().toLowerCase(); // 'create' | 'join'
        const roomCode = normalizeRoomCode(code);

        if (!["create", "join"].includes(roomMode)) {
          return res.status(400).json({
            success: false,
            message: "mode لازم يكون 'create' أو 'join'",
          });
        }

        if (!roomCode || roomCode.length < 4) {
          return res.status(400).json({
            success: false,
            message: "code مطلوب",
          });
        }

        // ========== CREATE ==========
        if (roomMode === "create") {
          if (getBattleRoomRaw(roomCode)) {
            return res.status(409).json({
              success: false,
              message:
                "الكود ده مستخدم في غرفة تانية، جرّب تولّد كود جديد ثم ابدأ المسابقة",
            });
          }

          const limitRaw =
            questionsCount !== undefined ? Number(questionsCount) : 10;
          const limit =
            Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50
              ? Math.round(limitRaw)
              : 10;

          const where = { isActive: true };
          const lvl = String(level || "").trim();
          if (lvl) where["level"] = lvl;

          const rows = await BattleFriendQuestionModel.findAll({
            where,
            order: [sequelize.random()],
            limit,
          });

          const questions = rows.map((r) => {
            const options = normalizeOptions(r.options);
            return {
              id: r.id,
              text: r.text,
              options,
              correctIndex: clampCorrectIndex(r.correctIndex, options),
            };
          });


          if (!questions.length) {
            return res.status(400).json({
              success: false,
              message: "لا توجد أسئلة متاحة للتحدي.",
            });
          }

          const room = {
            code: roomCode,
            createdAt: Date.now(),
            questions,
            players: {
              p1: { studentId, score: 0 },
              p2: null,
            },
            turnDurationSec: 20,
            currentQuestionIndex: 0,
            currentPlayerSlot: "p1",
            turnStartedAt: null,
            finished: false,
          };
          battleRooms.set(roomCode, room);

          const dto = serializeRoomForPlayer(room, "p1");
          return res.json({
            success: true,
            data: dto,
          });
        }

        // ========== JOIN ==========
        const room = getBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message:
              "الغرفة غير موجودة أو انتهت مدتها، خلى صاحبك يعمل كود جديد",
          });
        }

        let slot = getPlayerSlot(room, studentId);
        if (!slot) {
          if (!room.players.p2) {
            room.players.p2 = { studentId, score: 0 };
            slot = "p2";
          } else {
            return res.status(409).json({
              success: false,
              message: "الغرفة ممتلئة بالفعل",
            });
          }
        }

        if (
          room.players.p1 &&
          room.players.p2 &&
          !room.finished &&
          !room.turnStartedAt
        ) {
          room.turnStartedAt = Date.now();
        }

        const dto = serializeRoomForPlayer(room, slot);
        return res.json({
          success: true,
          data: dto,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/room/state:
   *   get:
   *     summary: جلب حالة غرفة Battle Friend الحالية
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: حالة الغرفة
   */
  router.get(
    "/battle-friend/room/state",
    requireAuth,
    async (req, res, next) => {
      try {
        const roomCode = normalizeRoomCode(req.query.code);
        if (!roomCode) {
          return res
            .status(400)
            .json({ success: false, message: "code مطلوب" });
        }

        const room = getBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: "الغرفة غير موجودة أو انتهت مدتها",
          });
        }

        const studentId = Number(req.user?.id);
        const slot = getPlayerSlot(room, studentId);
        if (!slot) {
          return res
            .status(403)
            .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
        }

        const dto = serializeRoomForPlayer(room, slot);
        return res.json({ success: true, data: dto });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/room/start-turn:
   *   post:
   *     summary: بدء دور اللاعب الحالي في Battle Friend
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *     responses:
   *       200:
   *         description: حالة الغرفة بعد بدء الدور
   */
  router.post(
    "/battle-friend/room/start-turn",
    requireAuth,
    async (req, res, next) => {
      try {
        const { code } = req.body || {};
        const roomCode = normalizeRoomCode(code);
        if (!roomCode) {
          return res
            .status(400)
            .json({ success: false, message: "code مطلوب" });
        }

        const room = getBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: "الغرفة غير موجودة أو انتهت مدتها",
          });
        }

        if (room.finished) {
          return res
            .status(400)
            .json({ success: false, message: "المباراة خلصت بالفعل" });
        }

        const studentId = Number(req.user?.id);
        const slot = getPlayerSlot(room, studentId);
        if (!slot) {
          return res
            .status(403)
            .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
        }

        if (room.currentPlayerSlot !== slot) {
          return res
            .status(403)
            .json({ success: false, message: "مش دورك دلوقتي" });
        }

        if (room.turnStartedAt) {
          return res
            .status(400)
            .json({ success: false, message: "الدور شغال بالفعل" });
        }

        room.turnStartedAt = Date.now();

        const dto = serializeRoomForPlayer(room, slot);
        return res.json({ success: true, data: dto });
      } catch (e) {
        next(e);
      }
    }
  );

  /**
   * @swagger
   * /games/battle-friend/room/answer:
   *   post:
   *     summary: إرسال إجابة سؤال Battle Friend في الغرفة
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *               optionIndex:
   *                 type: integer
   *     responses:
   *       200:
   *         description: حالة الغرفة بعد الإجابة
   */
  router.post(
    "/battle-friend/room/answer",
    requireAuth,
    async (req, res, next) => {
      try {
        const { code, optionIndex } = req.body || {};
        const roomCode = normalizeRoomCode(code);
        if (!roomCode) {
          return res
            .status(400)
            .json({ success: false, message: "code مطلوب" });
        }

        const room = getBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: "الغرفة غير موجودة أو انتهت مدتها",
          });
        }

        if (room.finished) {
          return res
            .status(400)
            .json({ success: false, message: "المباراة خلصت بالفعل" });
        }

        const studentId = Number(req.user?.id);
        const slot = getPlayerSlot(room, studentId);
        if (!slot) {
          return res
            .status(403)
            .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
        }

        if (room.currentPlayerSlot !== slot) {
          return res
            .status(403)
            .json({ success: false, message: "مش دورك دلوقتي" });
        }

        if (!Number.isFinite(Number(optionIndex))) {
          return res.status(400).json({
            success: false,
            message: "optionIndex رقم مطلوب",
          });
        }

        const q = room.questions[room.currentQuestionIndex];
        if (!q) {
          return res
            .status(400)
            .json({ success: false, message: "لا يوجد سؤال حالي" });
        }

        const remaining = getRemainingTime(room);
        let isCorrect = false;
        let gained = 0;

        if (room.turnStartedAt && remaining > 0) {
          isCorrect = Number(optionIndex) === q.correctIndex;
          if (isCorrect) {
            const base = 80;
            const bonusPerSecond = 3;
            gained = base + remaining * bonusPerSecond;
          }
        }

        if (slot === "p1") {
          room.players.p1.score += gained;
        } else if (room.players.p2) {
          room.players.p2.score += gained;
        }

        room.turnStartedAt = null;

        if (room.currentQuestionIndex < room.questions.length - 1) {
          room.currentQuestionIndex += 1;
          room.currentPlayerSlot =
            room.currentPlayerSlot === "p1" ? "p2" : "p1";

          room.turnStartedAt = Date.now();
        } else {
          room.finished = true;
        }

        const dto = serializeRoomForPlayer(room, slot, {
          lastAnswer: {
            isCorrect,
            gained,
            optionIndex: Number(optionIndex),
          },
        });

        return res.json({ success: true, data: dto });
      } catch (e) {
        next(e);
      }
    }
  );

  /* =========================================
     تسجيل نتيجة جولة (XP)
     ========================================= */

  /**
   * @swagger
   * /games/results:
   *   post:
   *     summary: تسجيل نتيجة لعبة (XP + score)
   *     description: متاح للطلاب فقط، يتم التسجيل في قاعدة البيانات الرئيسية
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GameResultCreateRequest'
   *     responses:
   *       200:
   *         description: تم تسجيل النتيجة
   */
  /* =========================================
     TEAM BATTLE GAME + ADMIN (2v2 .. 5v5)
     ========================================= */

  function mapTeamBattleQuestion(r) {
    const options = normalizeOptions(r.options);
    return {
      id: r.id,
      text: r.text,
      options,
      correctIndex: clampCorrectIndex(r.correctIndex, options),
      level: r.level ?? null,
      isActive: r.isActive,
    };
  }

  router.get(
    "/team-battle/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const level = String(req.query.level || "").trim() || null;
        const pageRaw = req.query.page !== undefined ? Number(req.query.page) : 1;
        const page =
          Number.isFinite(pageRaw) && pageRaw > 0 ? Math.round(pageRaw) : 1;

        const pageSizeRaw =
          req.query.pageSize !== undefined
            ? Number(req.query.pageSize)
            : req.query.limit !== undefined
              ? Number(req.query.limit)
              : 5;
        const pageSize =
          Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
            ? Math.min(5, Math.round(pageSizeRaw))
            : 5;

        const where = {};
        if (level) where["level"] = level;

        let currentPage = page;
        let offset = (currentPage - 1) * pageSize;

        let { rows, count } = await TeamBattleQuestionModel.findAndCountAll({
          where,
          order: [["id", "DESC"]],
          limit: pageSize,
          offset,
        });

        const totalItems = Number(count) || 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

        if (currentPage > totalPages) {
          currentPage = totalPages;
          offset = (currentPage - 1) * pageSize;
          ({ rows } = await TeamBattleQuestionModel.findAndCountAll({
            where,
            order: [["id", "DESC"]],
            limit: pageSize,
            offset,
          }));
        }

        res.json({
          success: true,
          data: rows.map(mapTeamBattleQuestion),
          pagination: {
            page: currentPage,
            pageSize,
            totalItems,
            totalPages,
            hasPrev: currentPage > 1,
            hasNext: currentPage < totalPages,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );



  /**
   * @swagger
   * /games/team-battle/admin/questions:
   *   post:
   *     summary: إضافة سؤال Team Battle واحد
   *     tags: [Games]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BattleFriendQuestion'
   *     responses:
   *       200:
   *         description: تم الإنشاء
   */
  router.post(
    "/team-battle/admin/questions",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const text = String(body.text || "").trim();
        const options = normalizeOptions(body.options);
        let correctIndex = toInt(body.correctIndex, 0);
        const level = body.level ? String(body.level).trim() : null;
        const isActive = body.isActive === false ? false : true;

        if (!text || text.length < 3) {
          return res.status(400).json({
            success: false,
            message: "نص السؤال مطلوب (3 أحرف على الأقل)",
          });
        }

        if (options.length < 2) {
          return res.status(400).json({
            success: false,
            message: "لازم يكون فيه اختيارين على الأقل",
          });
        }

        if (correctIndex < 0 || correctIndex >= options.length) {
          correctIndex = 0;
        }

        const created = await TeamBattleQuestionModel.create({
          text,
          options,
          correctIndex,
          level,
          isActive,
        });

        res.json({ success: true, data: mapTeamBattleQuestion(created) });
      } catch (e) {
        next(e);
      }
    }
  );

  router.put(
    "/team-battle/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, message: "ID غير صالح" });
        }

        const row = await TeamBattleQuestionModel.findByPk(id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, message: "السؤال غير موجود" });
        }

        const body = req.body || {};
        const patch = {};

        if (body.text !== undefined) {
          const text = String(body.text || "").trim();
          if (!text || text.length < 3) {
            return res.status(400).json({
              success: false,
              message: "نص السؤال مطلوب (3 أحرف على الأقل)",
            });
          }
          patch.text = text;
        }

        if (body.options !== undefined) {
          const options = normalizeOptions(body.options);
          if (options.length < 2) {
            return res.status(400).json({
              success: false,
              message: "لازم يكون فيه اختيارين على الأقل",
            });
          }
          patch.options = options;
        }

        if (body.correctIndex !== undefined) {
          const options = patch.options
            ? patch.options
            : normalizeOptions(row.options);
          patch.correctIndex = clampCorrectIndex(body.correctIndex, options);
        }

        if (body.level !== undefined) {
          patch.level = body.level ? String(body.level).trim() : null;
        }

        if (body.isActive !== undefined) {
          patch.isActive = body.isActive === false ? false : true;
        }

        patch["updatedAtLocal"] = new Date();
        await row.update(patch);

        const fresh = await TeamBattleQuestionModel.findByPk(id);
        res.json({ success: true, data: mapTeamBattleQuestion(fresh) });
      } catch (e) {
        next(e);
      }
    }
  );

  router.delete(
    "/team-battle/admin/questions/:id",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, message: "ID غير صالح" });
        }

        await TeamBattleQuestionModel.destroy({ where: { id } });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    }
  );

  router.get("/team-battle/questions", requireAuth, async (req, res, next) => {
    try {
      const level = String(req.query.level || "").trim() || null;
      const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : 10;
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50
          ? Math.round(limitRaw)
          : 10;

      const where = { isActive: true };
      if (level) where["level"] = level;

      const rows = await TeamBattleQuestionModel.findAll({
        where,
        order: [sequelize.random()],
        limit,
      });

      const data = rows.map((r) => {
        const options = normalizeOptions(r.options);
        return {
          id: r.id,
          text: r.text,
          options,
          correctIndex: clampCorrectIndex(r.correctIndex, options),
        };
      });

      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  router.post(
    "/team-battle/questions/bulk",
    requireAuth,
    requireRole("admin", "supervisor", "user"),
    async (req, res, next) => {
      try {
        const list = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.questions)
            ? req.body.questions
            : [];

        if (!list.length) {
          return res.status(400).json({
            success: false,
            message: "questions[] مطلوب وفيه عناصر",
          });
        }

        const payload = list
          .map((q) => {
            const options = normalizeOptions(q.options);
            return {
              text: String(q.text || "").trim(),
              options,
              correctIndex: clampCorrectIndex(q.correctIndex, options),
              level: q.level ? String(q.level).trim() : null,
              isActive: q.isActive === false ? false : true,
            };
          })
          .filter((q) => q.text && q.options.length >= 2);

        if (!payload.length) {
          return res.status(400).json({
            success: false,
            message: "كل الأسئلة فاضية أو مافيهاش options كفاية",
          });
        }

        const created = await TeamBattleQuestionModel.bulkCreate(payload, {
          returning: true,
        });

        res.json({ success: true, data: created.map(mapTeamBattleQuestion) });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post("/team-battle/room", requireAuth, async (req, res, next) => {
    try {
      const { mode, code, team, questionsCount, level } = req.body || {};
      const studentId = Number(req.user?.id);
      if (!studentId) {
        return res
          .status(401)
          .json({ success: false, message: "مطلوب تسجيل الدخول" });
      }

      const roomMode = String(mode || "").trim().toLowerCase();
      const roomCode = normalizeRoomCode(code);

      if (!["create", "join"].includes(roomMode)) {
        return res.status(400).json({
          success: false,
          message: "mode لازم يكون create أو join",
        });
      }

      if (!roomCode || roomCode.length < 4) {
        return res.status(400).json({
          success: false,
          message: "code مطلوب",
        });
      }

      if (roomMode === "create") {
        if (getTeamBattleRoomRaw(roomCode)) {
          return res.status(409).json({
            success: false,
            message: "الكود مستخدم بالفعل، جرّب كود جديد",
          });
        }

        const limitRaw =
          questionsCount !== undefined ? Number(questionsCount) : 10;
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
            ? Math.round(limitRaw)
            : 10;

        const where = { isActive: true };
        const lvl = String(level || "").trim();
        if (lvl) where["level"] = lvl;

        const rows = await TeamBattleQuestionModel.findAll({
          where,
          order: [sequelize.random()],
          limit,
        });

        const questions = rows.map((r) => {
          const options = normalizeOptions(r.options);
          return {
            id: r.id,
            text: r.text,
            options,
            correctIndex: clampCorrectIndex(r.correctIndex, options),
          };
        });

        if (!questions.length) {
          return res.status(400).json({
            success: false,
            message: "لا توجد أسئلة متاحة للمباراة.",
          });
        }

        const room = {
          code: roomCode,
          createdAt: Date.now(),
          questions,
          teams: {
            a: { members: [] },
            b: { members: [] },
          },
          turnDurationSec: 20,
          currentQuestionIndex: 0,
          currentTeam: "a",
          turnStartedAt: null,
          currentTurnExpectedMembers: [],
          currentTurnAnswered: {},
          finished: false,
        };

        const createTeam = normalizeTeamKey(team) || "a";
        room.teams[createTeam].members.push({ studentId, score: 0 });

        teamBattleRooms.set(roomCode, room);
        return res.json({
          success: true,
          data: serializeTeamBattleRoomForPlayer(room, studentId),
        });
      }

      const room = getTeamBattleRoom(roomCode);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "الغرفة غير موجودة أو انتهت مدتها",
        });
      }

      let memberTeam = getTeamBattleMemberTeam(room, studentId);
      if (!memberTeam) {
        let targetTeam = normalizeTeamKey(team);
        if (!targetTeam) {
          const aCount = room.teams.a.members.length;
          const bCount = room.teams.b.members.length;
          targetTeam = aCount <= bCount ? "a" : "b";
        }

        if (room.teams[targetTeam].members.length >= TEAM_BATTLE_MAX_PLAYERS) {
          return res.status(409).json({
            success: false,
            message: "الفريق ده كامل بالفعل",
          });
        }

        room.teams[targetTeam].members.push({ studentId, score: 0 });
        memberTeam = targetTeam;
      }

      if (isTeamBattleReady(room) && !room.finished && !room.turnStartedAt) {
        startTeamBattleTurn(room);
      }

      return res.json({
        success: true,
        data: serializeTeamBattleRoomForPlayer(room, studentId, {
          myTeam: memberTeam,
        }),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/team-battle/room/state", requireAuth, async (req, res, next) => {
    try {
      const roomCode = normalizeRoomCode(req.query.code);
      if (!roomCode) {
        return res.status(400).json({ success: false, message: "code مطلوب" });
      }

      const room = getTeamBattleRoom(roomCode);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "الغرفة غير موجودة أو انتهت مدتها",
        });
      }

      const studentId = Number(req.user?.id);
      const team = getTeamBattleMemberTeam(room, studentId);
      if (!team) {
        return res
          .status(403)
          .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
      }

      return res.json({
        success: true,
        data: serializeTeamBattleRoomForPlayer(room, studentId),
      });
    } catch (e) {
      next(e);
    }
  });

  router.post(
    "/team-battle/room/start-turn",
    requireAuth,
    async (req, res, next) => {
      try {
        const { code } = req.body || {};
        const roomCode = normalizeRoomCode(code);
        if (!roomCode) {
          return res.status(400).json({ success: false, message: "code مطلوب" });
        }

        const room = getTeamBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: "الغرفة غير موجودة أو انتهت مدتها",
          });
        }

        if (room.finished) {
          return res
            .status(400)
            .json({ success: false, message: "المباراة خلصت بالفعل" });
        }

        if (!isTeamBattleReady(room)) {
          return res.status(400).json({
            success: false,
            message: "لازم كل فريق يكون فيه على الأقل لاعبين",
          });
        }

        const studentId = Number(req.user?.id);
        const team = getTeamBattleMemberTeam(room, studentId);
        if (!team) {
          return res
            .status(403)
            .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
        }

        if (room.currentTeam !== team) {
          return res.status(403).json({ success: false, message: "مش دور فريقك" });
        }

        if (room.turnStartedAt) {
          return res
            .status(400)
            .json({ success: false, message: "الدور شغال بالفعل" });
        }

        startTeamBattleTurn(room);
        return res.json({
          success: true,
          data: serializeTeamBattleRoomForPlayer(room, studentId),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    "/team-battle/room/answer",
    requireAuth,
    async (req, res, next) => {
      try {
        const { code, optionIndex } = req.body || {};
        const roomCode = normalizeRoomCode(code);
        if (!roomCode) {
          return res.status(400).json({ success: false, message: "code مطلوب" });
        }

        const room = getTeamBattleRoom(roomCode);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: "الغرفة غير موجودة أو انتهت مدتها",
          });
        }

        if (room.finished) {
          return res
            .status(400)
            .json({ success: false, message: "المباراة خلصت بالفعل" });
        }

        if (!isTeamBattleReady(room)) {
          return res.status(400).json({
            success: false,
            message: "لازم كل فريق يكون فيه على الأقل لاعبين",
          });
        }

        const studentId = Number(req.user?.id);
        const team = getTeamBattleMemberTeam(room, studentId);
        if (!team) {
          return res
            .status(403)
            .json({ success: false, message: "أنت مش مشترك في الغرفة دي" });
        }

        if (room.currentTeam !== team) {
          return res.status(403).json({ success: false, message: "مش دور فريقك" });
        }

        if (!Number.isFinite(Number(optionIndex))) {
          return res.status(400).json({
            success: false,
            message: "optionIndex رقم مطلوب",
          });
        }

        const q = room.questions[room.currentQuestionIndex];
        if (!q) {
          return res
            .status(400)
            .json({ success: false, message: "لا يوجد سؤال حالي" });
        }

        if (!room.turnStartedAt) {
          return res.status(400).json({
            success: false,
            message: "Ø§Ù„Ø¯ÙˆØ± Ù„Ø³Ù‡ Ù…Ø§ Ø¨Ø¯Ø£Ø´",
          });
        }

        ensureTeamBattleTurnState(room);

        if (!isTeamBattleMemberExpectedCurrentTurn(room, studentId)) {
          return res.status(409).json({
            success: false,
            message:
              "Ø§Ù†Øª Ø§Ù†Ø¶Ù…ÙŠØª Ø¨Ø¹Ø¯ Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ø¯ÙˆØ±ØŒ Ù‡ØªØ¬Ø§ÙˆØ¨ Ù…Ø¹ Ø§Ù„Ø³Ø¤Ø§Ù„ Ø§Ù„Ø¬Ø§ÙŠ",
          });
        }

        if (hasTeamBattleMemberAnsweredCurrentTurn(room, studentId)) {
          return res.status(409).json({
            success: false,
            message: "Ø£Ù†Øª Ø¬Ø§ÙˆØ¨Øª Ø§Ù„Ø³Ø¤Ø§Ù„ Ø¯Ù‡ Ù‚Ø¨Ù„ ÙƒØ¯Ù‡",
          });
        }

        const isCorrect = Number(optionIndex) === q.correctIndex;
        let gained = 0;

        if (isCorrect) {
          // Team question scoring depends on number of correct members, not speed.
          gained = 100;
        }

        const member = getTeamBattleMember(room, studentId);
        if (member) {
          member.score = Number(member.score || 0) + gained;
        }

        room.currentTurnAnswered[String(studentId)] = {
          optionIndex: Number(optionIndex),
          isCorrect,
          gained,
          answeredAt: Date.now(),
        };

        const answeredCount = getTeamBattleTurnAnsweredCount(room);
        const requiredCount = getTeamBattleTurnRequiredCount(room);

        if (requiredCount > 0 && answeredCount >= requiredCount) {
          advanceTeamBattleTurn(room);
        }

        return res.json({
          success: true,
          data: serializeTeamBattleRoomForPlayer(room, studentId, {
            lastAnswer: {
              isCorrect,
              gained,
              optionIndex: Number(optionIndex),
            },
          }),
        });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post("/results", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== "student") {
        return res
          .status(403)
          .json({ success: false, message: "مصرّح للطلاب فقط" });
      }

      const { gameKey, xp, score = 0, meta } = req.body || {};
      const errors = [];

      if (!gameKey || typeof gameKey !== "string") {
        errors.push("gameKey مطلوب");
      }
      if (xp === undefined || xp === null || Number.isNaN(Number(xp))) {
        errors.push("xp رقم مطلوب");
      }

      if (errors.length) {
        return res.status(400).json({ success: false, errors });
      }

      const safeXp = Math.min(Math.max(Number(xp), 0), 5000);
      const safeScore = Math.max(Number(score), 0);

      const data = {
        studentId: Number(req.user.id),
        gameKey: String(gameKey).trim(),
        xp: safeXp,
        score: safeScore,
        meta: meta ?? null,
        createdAtLocal: new Date(),
        updatedAtLocal: new Date(),
      };

      const created = await GameSessionModel.create(data);

      return res.json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  });

  /* =========================================
     LEADERBOARD
     ========================================= */

  /**
   * @swagger
   * /games/leaderboard:
   *   get:
   *     summary: ترتيب اللاعبين حسب إجمالي الـ XP
   *     tags: [Games]
   *     parameters:
   *       - in: query
   *         name: gameKey
   *         schema:
   *           type: string
   *           default: all
   *         description: لو all يتم التجميع على كل الألعاب
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           maximum: 50
   *     responses:
   *       200:
   *         description: قائمة الترتيب
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/GameLeaderboardEntry'
   */
  router.get("/leaderboard", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const gameKeyRaw = String(req.query.gameKey || "all").trim();

      const where = {};
      if (gameKeyRaw && gameKeyRaw !== "all") {
        where.gameKey = gameKeyRaw;
      }

      const rows = await GameSessionModel.findAll({
        attributes: [
          "studentId",
          [fn("SUM", col("xp")), "totalXp"],
          [fn("COUNT", col("id")), "gamesCount"],
        ],
        where,
        group: ["studentId"],
        order: [[literal("totalXp"), "DESC"]],
        limit,
        raw: true,
      });

      const studentIds = rows.map((r) => r.studentId);
      const students = await StudentModel.findAll({
        where: { id: studentIds },
        attributes: ["id", "studentName", "centerName", "year"],
        raw: true,
      });

      const map = new Map(students.map((s) => [s.id, s]));

      const data = rows.map((row, idx) => {
        const s = map.get(row.studentId) || {};
        return {
          rank: idx + 1,
          studentId: row.studentId,
          name: s.studentName || "طالب",
          centerName: s.centerName || null,
          level: s.year || null,
          totalXp: Number(row.totalXp) || 0,
          gamesCount: Number(row.gamesCount) || 0,
        };
      });

      return res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
