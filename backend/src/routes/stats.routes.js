// src/routes/stats.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import { Op, fn, col } from "sequelize";

// -------------------- helpers --------------------
function pickModel(models, names) {
  for (const n of names) if (models?.[n]) return models[n];
  return null;
}

function pickAttr(model, names) {
  const ra = model?.rawAttributes || {};
  for (const n of names) if (ra[n]) return n;
  return null;
}

function findExistingBelongsTo(source, target, foreignKey) {
  const assocs = source?.associations || {};
  for (const a of Object.values(assocs)) {
    if (
      a &&
      a.associationType === "BelongsTo" &&
      a.target === target &&
      String(a.foreignKey || "") === String(foreignKey || "")
    ) {
      return a;
    }
  }
  return null;
}

function ensureBelongsTo(source, target, { as, foreignKey }) {
  if (!source || !target) return null;

  // association بنفس target+foreignKey حتى لو alias مختلف
  const byFk = findExistingBelongsTo(source, target, foreignKey);
  if (byFk) return byFk;

  // alias موجود
  const safeAs = (as || "").trim() || undefined;
  if (safeAs && source.associations?.[safeAs]) return source.associations[safeAs];

  // create
  const finalAs = safeAs || `${target?.name || "rel"}_${foreignKey || "id"}`;
  source.belongsTo(target, { foreignKey, as: finalAs });
  return source.associations?.[finalAs] || null;
}

function centsToEGP(cents) {
  const v = Number(cents || 0) / 100;
  return `${v.toLocaleString()} EGP`;
}

function toIsoSafe(value) {
  if (!value && value !== 0) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function notDeletedWhere(model) {
  if (!model) return {};
  const f =
    pickAttr(model, ["isDeleted", "deleted", "is_deleted", "is_removed"]) || null;
  return f ? { [f]: false } : {};
}

// -------------------- router --------------------
export default function createStatsRouter(models) {
  const router = Router();

  // Core
  const StudentModel = pickModel(models, ["StudentMysql", "Student"]);
  const CourseModel = pickModel(models, ["CourseMysql", "Course"]);
  const SubscriptionModel = pickModel(models, ["SubscriptionMysql", "Subscription"]);
  const LiveSessionModel = pickModel(models, ["LiveSessionMysql", "LiveSession"]);
  const PlanModel = pickModel(models, ["PlanMysql", "Plan"]);

  // Vouchers / Wallet
  const WalletModel = pickModel(models, ["WalletMysql", "Wallet", "WalletModel", "Wallets"]);
  const WalletTxModel = pickModel(models, [
    "WalletTxMysql",
    "WalletTx",
    "WalletTxModel",
    "WalletTransactions",
  ]);
  const VoucherModel = pickModel(models, ["VoucherMysql", "Voucher", "VoucherModel", "Vouchers"]);

  // Centers / Attendance
  const CenterModel = pickModel(models, ["CenterMysql", "Center", "CenterModel", "Centers"]);
  const StudentAttendanceModel = pickModel(models, [
    "StudentAttendanceMysql",
    "StudentAttendance",
    "StudentAttendanceModel",
  ]);

  // Checkout (manual orders notifications)
  const OrderModel = pickModel(models, ["OrderMysql", "Order", "OrderModel"]);
  const OrderItemModel = pickModel(models, ["OrderItemMysql", "OrderItem", "OrderItemModel"]);
  const PaymentModel = pickModel(models, ["PaymentMysql", "Payment", "PaymentModel"]);
  const ExamAttemptModel = pickModel(models, ["ExamAttemptMysql", "ExamAttempt"]);
  const StudentLessonProgressModel = pickModel(models, ["StudentLessonProgressMysql", "StudentLessonProgress"]);
  const LessonModel = pickModel(models, ["LessonMysql", "Lesson"]);
  const ExamModel = pickModel(models, ["ExamMysql", "Exam"]);

  // -------- discover fields once --------
  const studentYearField = pickAttr(StudentModel, ["year", "grade", "level", "classLevel"]);
  const studentNameField = pickAttr(StudentModel, ["studentName", "name", "fullName"]);
  const studentCreatedField = pickAttr(StudentModel, [
    "createdAt",
    "updatedAtLocal",
    "createdAtLocal",
    "created_at",
  ]);
  const studentCenterIdField = pickAttr(StudentModel, ["centerId", "center_id"]);

  const courseLevelField = pickAttr(CourseModel, ["level", "grade", "year", "classLevel"]);
  const courseStatusField = pickAttr(CourseModel, ["status", "publishStatus", "state"]);
  const courseIsPublishedField = pickAttr(CourseModel, ["isPublished", "published"]);

  const subStartField = pickAttr(SubscriptionModel, ["startsAt", "startDate", "createdAt", "createdAtLocal"]);
  const liveStartField = LiveSessionModel
    ? pickAttr(LiveSessionModel, ["startsAt", "startAt", "date", "createdAt"])
    : null;

  const centerNameField = pickAttr(CenterModel, ["name", "title"]);
  const attDateField = pickAttr(StudentAttendanceModel, [
    "attendedAt",
    "createdAt",
    "createdAtLocal",
    "updatedAtLocal",
  ]);
  const attCenterIdField = pickAttr(StudentAttendanceModel, ["centerId", "center_id"]);
  const attStudentIdField = pickAttr(StudentAttendanceModel, ["studentId", "student_id"]);

  const orderStatusField = pickAttr(OrderModel, ["status", "orderStatus", "state"]);
  const orderProviderField = pickAttr(OrderModel, ["provider", "paymentProvider"]);
  const orderTotalField = pickAttr(OrderModel, ["totalCents", "amountCents", "totalAmountCents"]);
  const orderCurrencyField = pickAttr(OrderModel, ["currency"]);
  const orderCreatedField = pickAttr(OrderModel, ["createdAt", "createdAtLocal", "updatedAt"]);

  const paymentStatusField = pickAttr(PaymentModel, ["status"]);
  const paymentProviderField = pickAttr(PaymentModel, ["provider"]);
  const paymentCreatedField = pickAttr(PaymentModel, ["createdAt", "createdAtLocal", "updatedAt"]);

  // -------- associations once --------
  const planAssoc =
    SubscriptionModel && PlanModel
      ? ensureBelongsTo(SubscriptionModel, PlanModel, { as: "plan", foreignKey: "planId" })
      : null;

  const subStudentAssoc =
    SubscriptionModel && StudentModel
      ? ensureBelongsTo(SubscriptionModel, StudentModel, { as: "student", foreignKey: "studentId" })
      : null;

  const txWalletAssoc =
    WalletTxModel && WalletModel
      ? ensureBelongsTo(WalletTxModel, WalletModel, { as: "wallet", foreignKey: "walletId" })
      : null;

  const walletStudentAssoc =
    WalletModel && StudentModel
      ? ensureBelongsTo(WalletModel, StudentModel, { as: "student", foreignKey: "studentId" })
      : null;

  const attStudentAssoc =
    StudentAttendanceModel && StudentModel && attStudentIdField
      ? ensureBelongsTo(StudentAttendanceModel, StudentModel, {
          as: "student",
          foreignKey: attStudentIdField, // قد تكون studentId أو student_id
        })
      : null;

  const paymentOrderAssoc =
    PaymentModel && OrderModel
      ? ensureBelongsTo(PaymentModel, OrderModel, { as: "order", foreignKey: "orderId" })
      : null;

  const orderStudentAssoc =
    OrderModel && StudentModel
      ? ensureBelongsTo(OrderModel, StudentModel, { as: "student", foreignKey: "studentId" })
      : null;

  // -------------------- endpoint --------------------
  router.get("/dashboard", requireAuth, requireRole("admin", "supervisor", "center_manager", "support"), async (req, res) => {
    try {
      const userRole = req.user?.role;
      const userCenterId = req.user?.centerId;
      // If center_manager, we force filter by their assigned center
      const forceCenterId = (userRole === 'center_manager' && userCenterId) ? userCenterId : null;

      if (!StudentModel || !CourseModel || !SubscriptionModel) {
        return res.status(500).json({
          success: false,
          message: "Stats models missing (Student/Course/Subscription).",
        });
      }

      const grade = String(req.query.grade || "").trim();
      const hasGrade = grade && grade !== "all";

      // filters
      const studentWhere = {};
      if (hasGrade && studentYearField) {
        studentWhere[studentYearField] = { [Op.like]: `%${grade}%` };
      }
      if (forceCenterId && studentCenterIdField) {
        studentWhere[studentCenterIdField] = forceCenterId;
      }

      const courseWhere = {};
      if (hasGrade && courseLevelField) {
        courseWhere[courseLevelField] = { [Op.like]: `%${grade}%` };
      }
      if (courseStatusField) courseWhere[courseStatusField] = "published";
      else if (courseIsPublishedField) courseWhere[courseIsPublishedField] = true;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // 1) total students
      const totalStudentsPromise = StudentModel.count({ where: studentWhere });

      // 2) total published courses
      const totalCoursesPromise = CourseModel.count({ where: courseWhere });

      // 3) monthly income (sum plan prices for subs started this month)
      const monthlyIncomePromise = (async () => {
        let monthlyIncomeCents = 0;
        if (!PlanModel || !planAssoc || !subStartField) return 0;

        const priceField = pickAttr(PlanModel, ["priceCents", "price", "amountCents"]);
        if (!priceField) return 0;

        const rows = await SubscriptionModel.findAll({
          where: { [subStartField]: { [Op.gte]: startOfMonth } },
          include: [
            {
              association: planAssoc,
              required: true,
              attributes: [priceField],
            },
            subStudentAssoc
              ? {
                  association: subStudentAssoc,
                  required: hasGrade && !!studentYearField,
                  where: hasGrade && studentYearField ? studentWhere : undefined,
                  attributes: [],
                }
              : null,
          ].filter(Boolean),
        });

        for (const sub of rows) {
          const plan = sub?.[planAssoc.as];
          monthlyIncomeCents += Number(plan?.[priceField] || 0);
        }
        return monthlyIncomeCents;
      })();

      // 4) upcoming live sessions
      const upcomingLivesPromise = (async () => {
        if (!LiveSessionModel || !liveStartField) return 0;
        return LiveSessionModel.count({
          where: { [liveStartField]: { [Op.gte]: new Date() } },
        });
      })();

      // 5) used voucher cents this month (WalletTx reason=VOUCHER_REDEEM)
      const usedVoucherPromise = (async () => {
        let usedVoucherCents = 0;

        if (WalletTxModel && txWalletAssoc) {
          const txWhere = {
            reason: "VOUCHER_REDEEM",
            createdAt: { [Op.gte]: startOfMonth },
          };

          try {
            const sum = await WalletTxModel.sum("amountCents", {
              where: txWhere,
              include: [
                {
                  association: txWalletAssoc,
                  required: true,
                  attributes: [],
                  include: walletStudentAssoc
                    ? [
                        {
                          association: walletStudentAssoc,
                          required: hasGrade && !!studentYearField,
                          where: hasGrade && studentYearField ? studentWhere : undefined,
                          attributes: [],
                        },
                      ]
                    : [],
                },
              ],
            });

            usedVoucherCents = Number(sum || 0);
          } catch {
            const rows = await WalletTxModel.findAll({
              where: txWhere,
              attributes: ["amountCents"],
              include: [
                {
                  association: txWalletAssoc,
                  required: true,
                  attributes: [],
                  include: walletStudentAssoc
                    ? [
                        {
                          association: walletStudentAssoc,
                          required: hasGrade && !!studentYearField,
                          where: hasGrade && studentYearField ? studentWhere : undefined,
                          attributes: [],
                        },
                      ]
                    : [],
                },
              ],
            });
            usedVoucherCents = rows.reduce((acc, r) => acc + Number(r.amountCents || 0), 0);
          }

          return usedVoucherCents;
        }

        // fallback: vouchers only (no grade filter)
        if (VoucherModel) {
          const redeemedAtField = pickAttr(VoucherModel, ["redeemedAt", "updatedAtLocal", "updatedAt", "createdAt"]);
          const amountField = pickAttr(VoucherModel, ["amountCents", "remainingCents"]);
          if (!redeemedAtField || !amountField) return 0;

          const rows = await VoucherModel.findAll({
            where: {
              status: { [Op.in]: ["redeemed", "partially_redeemed"] },
              [redeemedAtField]: { [Op.gte]: startOfMonth },
            },
            attributes: [amountField],
          });

          return rows.reduce((acc, v) => acc + Number(v?.[amountField] || 0), 0);
        }

        return 0;
      })();

      // 6) recent students
      const recentStudentsPromise = StudentModel.findAll({
        where: studentWhere,
        limit: 5,
        order: studentCreatedField ? [[studentCreatedField, "DESC"]] : [["id", "DESC"]],
        attributes: [
          "id",
          ...(studentNameField ? [studentNameField] : []),
          ...(studentYearField ? [studentYearField] : []),
          ...(studentCreatedField ? [studentCreatedField] : []),
        ],
      });

      // 7) centers: students per center
      const centersStudentsPromise = (async () => {
        if (!CenterModel || !studentCenterIdField) {
          return {
            totalCenters: 0,
            studentsByCenter: [],
          };
        }

        const centerWhere = notDeletedWhere(CenterModel);
        if (forceCenterId) {
          centerWhere.id = forceCenterId;
        }

        const centers = await CenterModel.findAll({
          where: centerWhere,
          attributes: ["id", ...(centerNameField ? [centerNameField] : [])],
          order: [["id", "ASC"]],
        });

        // group student counts by centerId (respects grade filter)
        let grouped = [];
        try {
          grouped = await StudentModel.findAll({
            where: {
              ...studentWhere,
              [studentCenterIdField]: { [Op.ne]: null },
            },
            attributes: [
              [col(studentCenterIdField), "centerId"],
              [fn("COUNT", col("id")), "studentsCount"],
            ],
            group: [col(studentCenterIdField)],
          });
        } catch {
          // fallback: JS counting
          const rows = await StudentModel.findAll({
            where: {
              ...studentWhere,
              [studentCenterIdField]: { [Op.ne]: null },
            },
            attributes: ["id", studentCenterIdField],
          });

          const map = new Map();
          for (const r of rows) {
            const cId = Number(r?.[studentCenterIdField] || 0);
            if (!cId) continue;
            map.set(cId, (map.get(cId) || 0) + 1);
          }
          grouped = Array.from(map.entries()).map(([centerId, studentsCount]) => ({
            centerId,
            studentsCount,
          }));
        }

        const countMap = new Map();
        for (const g of grouped) {
          const j = g?.toJSON ? g.toJSON() : g;
          const cId = Number(j.centerId ?? j?.[studentCenterIdField] ?? 0);
          const cnt = Number(j.studentsCount ?? j?.studentsCount ?? 0);
          if (cId) countMap.set(cId, cnt);
        }

        const studentsByCenter = centers.map((c) => {
          const cj = c?.toJSON ? c.toJSON() : c;
          const cId = Number(cj.id);
          return {
            centerId: cId,
            centerName: centerNameField ? (cj[centerNameField] || `Center #${cId}`) : `Center #${cId}`,
            studentsCount: Number(countMap.get(cId) || 0),
          };
        });

        return {
          totalCenters: centers.length,
          studentsByCenter,
        };
      })();

      // 8) attendance per center (this month)
      const attendanceByCenterPromise = (async () => {
        if (!StudentAttendanceModel || !attDateField || !attCenterIdField) {
          return {
            attendanceThisMonth: 0,
            uniqueStudentsThisMonth: 0,
            attendanceByCenter: [],
          };
        }

        const whereBase = {
          [attDateField]: { [Op.gte]: startOfMonth },
        };

        // total attendance records
        const attendanceThisMonth = await StudentAttendanceModel.count({
          where: whereBase,
          include:
            hasGrade && attStudentAssoc && studentYearField
              ? [
                  {
                    association: attStudentAssoc,
                    required: true,
                    where: studentWhere,
                    attributes: [],
                  },
                ]
              : [],
        });

        // unique students this month
        let uniqueStudentsThisMonth = 0;
        try {
          if (attStudentIdField) {
            uniqueStudentsThisMonth = await StudentAttendanceModel.count({
              where: whereBase,
              distinct: true,
              col: attStudentIdField,
              include:
                hasGrade && attStudentAssoc && studentYearField
                  ? [
                      {
                        association: attStudentAssoc,
                        required: true,
                        where: studentWhere,
                        attributes: [],
                      },
                    ]
                  : [],
            });
          }
        } catch {
          uniqueStudentsThisMonth = 0;
        }

        // per center aggregation
        let rows = [];
        try {
          rows = await StudentAttendanceModel.findAll({
            where: whereBase,
            attributes: [
              [col(attCenterIdField), "centerId"],
              [fn("COUNT", col("id")), "attendanceCount"],
              ...(attStudentIdField
                ? [[fn("COUNT", fn("DISTINCT", col(attStudentIdField))), "uniqueStudents"]]
                : []),
            ],
            group: [col(attCenterIdField)],
            include:
              hasGrade && attStudentAssoc && studentYearField
                ? [
                    {
                      association: attStudentAssoc,
                      required: true,
                      where: studentWhere,
                      attributes: [],
                    },
                  ]
                : [],
          });
        } catch {
          // fallback JS
          const raw = await StudentAttendanceModel.findAll({
            where: whereBase,
            attributes: ["id", attCenterIdField, ...(attStudentIdField ? [attStudentIdField] : [])],
            include:
              hasGrade && attStudentAssoc && studentYearField
                ? [
                    {
                      association: attStudentAssoc,
                      required: true,
                      where: studentWhere,
                      attributes: [],
                    },
                  ]
                : [],
          });

          const map = new Map(); // centerId -> {attendanceCount, setStudents}
          for (const r of raw) {
            const j = r?.toJSON ? r.toJSON() : r;
            const cId = Number(j?.[attCenterIdField] || 0);
            if (!cId) continue;

            if (!map.has(cId)) map.set(cId, { attendanceCount: 0, students: new Set() });
            const obj = map.get(cId);
            obj.attendanceCount += 1;

            if (attStudentIdField) {
              const sId = Number(j?.[attStudentIdField] || 0);
              if (sId) obj.students.add(sId);
            }
          }

          rows = Array.from(map.entries()).map(([centerId, v]) => ({
            centerId,
            attendanceCount: v.attendanceCount,
            uniqueStudents: v.students.size,
          }));
        }

        const attendanceByCenter = rows.map((r) => {
          const j = r?.toJSON ? r.toJSON() : r;
          return {
            centerId: Number(j.centerId || j?.[attCenterIdField] || 0),
            attendanceCount: Number(j.attendanceCount || 0),
            uniqueStudents: Number(j.uniqueStudents || 0),
          };
        });

        return {
          attendanceThisMonth,
          uniqueStudentsThisMonth,
          attendanceByCenter,
        };
      })();

      // 9) checkout pending notifications (manual)
      const checkoutNotificationsPromise = (async () => {
        const result = {
          pendingCount: 0,
          latest: [],
        };

        if (!OrderModel && !PaymentModel) return result;

        // prefer payments pending (more accurate “طالب بعت طلب + مستني تأكيد”)
        if (PaymentModel && paymentProviderField && paymentStatusField) {
          const payWhere = {
            [paymentProviderField]: "manual",
            [paymentStatusField]: "pending",
          };

          try {
            const includeOrderStudent =
              paymentOrderAssoc && orderStudentAssoc && hasGrade && studentYearField
                ? [
                    {
                      association: paymentOrderAssoc,
                      required: true,
                      attributes: ["id", "studentId", ...(orderTotalField ? [orderTotalField] : []), ...(orderCurrencyField ? [orderCurrencyField] : []), ...(orderCreatedField ? [orderCreatedField] : [])],
                      include: [
                        {
                          association: orderStudentAssoc,
                          required: true,
                          where: studentWhere,
                          attributes: ["id", ...(studentNameField ? [studentNameField] : []), ...(studentYearField ? [studentYearField] : [])],
                        },
                      ],
                    },
                  ]
                : paymentOrderAssoc
                  ? [
                      {
                        association: paymentOrderAssoc,
                        required: true,
                        attributes: ["id", "studentId", ...(orderTotalField ? [orderTotalField] : []), ...(orderCurrencyField ? [orderCurrencyField] : []), ...(orderCreatedField ? [orderCreatedField] : [])],
                        include: orderStudentAssoc
                          ? [
                              {
                                association: orderStudentAssoc,
                                required: false,
                                attributes: ["id", ...(studentNameField ? [studentNameField] : []), ...(studentYearField ? [studentYearField] : [])],
                              },
                            ]
                          : [],
                      },
                    ]
                  : [];

            result.pendingCount = await PaymentModel.count({
              where: payWhere,
              include: includeOrderStudent,
            });

            const latestPayments = await PaymentModel.findAll({
              where: payWhere,
              order: [[paymentCreatedField || "id", "DESC"]],
              limit: 10,
              include: includeOrderStudent,
            });

            // load items for orders (N+1 but only 10)
            const latest = [];
            for (const p of latestPayments) {
              const pj = p?.toJSON ? p.toJSON() : p;
              const order = paymentOrderAssoc ? p?.[paymentOrderAssoc.as] : null;
              const oj = order?.toJSON ? order.toJSON() : order;

              const student = orderStudentAssoc && order ? order?.[orderStudentAssoc.as] : null;
              const sj = student?.toJSON ? student.toJSON() : student;

              let itemTitle = null;
              let itemType = null;

              if (OrderItemModel && oj?.id) {
                const it = await OrderItemModel.findOne({
                  where: { orderId: oj.id },
                  order: [["id", "ASC"]],
                });
                if (it) {
                  const ij = it.toJSON ? it.toJSON() : it;
                  itemTitle = ij.title || null;
                  itemType = ij.itemType || null;
                }
              }

              // proof image inference
              const proofImageUrl =
                pj.proofImageUrl ||
                pj.screenshotUrl ||
                pj.imageUrl ||
                (pj.meta && typeof pj.meta === "object"
                  ? pj.meta.proofImageUrl || pj.meta.screenshotUrl || pj.meta.imageUrl
                  : null) ||
                null;

              const studentName =
                (studentNameField && sj?.[studentNameField]) ||
                sj?.studentName ||
                sj?.name ||
                null;

              latest.push({
                paymentId: pj.id,
                orderId: oj?.id || pj.orderId || null,
                studentId: oj?.studentId || null,
                studentName,
                year: studentYearField ? (sj?.[studentYearField] ?? null) : (sj?.year ?? null),
                itemType,
                itemTitle,
                amountCents: pj.amountCents ?? oj?.[orderTotalField] ?? null,
                currency: pj.currency ?? oj?.[orderCurrencyField] ?? "EGP",
                createdAt: toIsoSafe(pj?.[paymentCreatedField] ?? pj.createdAt ?? oj?.[orderCreatedField] ?? oj?.createdAt) || null,
                proofImageUrl,
              });
            }

            result.latest = latest;
            return result;
          } catch {
            // ignore and fallback below
          }
        }

        // fallback: orders pending provider manual
        if (OrderModel && orderProviderField && orderStatusField) {
          const ordWhere = {
            [orderProviderField]: "manual",
            [orderStatusField]: "pending",
          };

          try {
            result.pendingCount = await OrderModel.count({
              where: ordWhere,
              include:
                hasGrade && orderStudentAssoc && studentYearField
                  ? [
                      {
                        association: orderStudentAssoc,
                        required: true,
                        where: studentWhere,
                        attributes: [],
                      },
                    ]
                  : [],
            });

            const orders = await OrderModel.findAll({
              where: ordWhere,
              order: [[orderCreatedField || "id", "DESC"]],
              limit: 10,
              include:
                orderStudentAssoc
                  ? [
                      {
                        association: orderStudentAssoc,
                        required: hasGrade && !!studentYearField,
                        where: hasGrade && studentYearField ? studentWhere : undefined,
                        attributes: ["id", ...(studentNameField ? [studentNameField] : []), ...(studentYearField ? [studentYearField] : [])],
                      },
                    ]
                  : [],
            });

            const latest = [];
            for (const o of orders) {
              const oj = o?.toJSON ? o.toJSON() : o;
              const student = orderStudentAssoc ? o?.[orderStudentAssoc.as] : null;
              const sj = student?.toJSON ? student.toJSON() : student;

              let itemTitle = null;
              let itemType = null;

              if (OrderItemModel && oj?.id) {
                const it = await OrderItemModel.findOne({
                  where: { orderId: oj.id },
                  order: [["id", "ASC"]],
                });
                if (it) {
                  const ij = it.toJSON ? it.toJSON() : it;
                  itemTitle = ij.title || null;
                  itemType = ij.itemType || null;
                }
              }

              const studentName =
                (studentNameField && sj?.[studentNameField]) ||
                sj?.studentName ||
                sj?.name ||
                null;

              latest.push({
                orderId: oj.id,
                studentId: oj.studentId || null,
                studentName,
                year: studentYearField ? (sj?.[studentYearField] ?? null) : (sj?.year ?? null),
                itemType,
                itemTitle,
                amountCents: orderTotalField ? (oj?.[orderTotalField] ?? null) : (oj.totalCents ?? null),
                currency: orderCurrencyField ? (oj?.[orderCurrencyField] ?? "EGP") : (oj.currency ?? "EGP"),
                createdAt: toIsoSafe(oj?.[orderCreatedField] ?? oj.createdAt) || null,
              });
            }

            result.latest = latest;
            return result;
          } catch {
            return result;
          }
        }

        return result;
      })();

      // -------- resolve all --------
      const [
        totalStudents,
        totalCourses,
        monthlyIncomeCents,
        upcomingLives,
        usedVoucherCents,
        recentStudents,
        centersStudents,
        attendanceAgg,
        checkoutNotifications,
      ] = await Promise.all([
        totalStudentsPromise,
        totalCoursesPromise,
        monthlyIncomePromise,
        upcomingLivesPromise,
        usedVoucherPromise,
        recentStudentsPromise,
        centersStudentsPromise,
        attendanceByCenterPromise,
        checkoutNotificationsPromise,
      ]);

      // -------- activity feed (merge students + pending checkout) --------
      const studentActivities = (recentStudents || []).map((s) => {
        const name = studentNameField ? s[studentNameField] : "طالب";
        const yr = studentYearField ? s[studentYearField] : null;
        const t = studentCreatedField ? s[studentCreatedField] : null;
        return {
          kind: "student",
          text: `طالب جديد: ${name} (${yr || "غير محدد"})`,
          time: t ? toIsoSafe(t) : null,
          icon: "ri-user-add-line",
        };
      });

      const checkoutActivities = (checkoutNotifications?.latest || []).map((x) => {
        const orderId = x.orderId || null;
        const title = x.itemTitle || "طلب شراء";
        const stu = x.studentName || "طالب";
        return {
          kind: "checkout",
          text: `طلب دفع يدوي معلّق: #${orderId || "?"} — ${title} — ${stu}`,
          time: x.createdAt || null,
          icon: "ri-notification-3-line",
          meta: x,
        };
      });

      const mergedActivities = [...studentActivities, ...checkoutActivities]
        .filter((a) => a.time)
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 10);

      return res.json({
        success: true,
        data: {
          kpis: [
            { label: "إجمالي الطلاب", value: totalStudents, icon: "ri-group-line", color: "#3b82f6" },
            { label: "كورسات منشورة", value: totalCourses, icon: "ri-book-open-line", color: "#10b981" },
            { label: "إيراد الشهر", value: centsToEGP(monthlyIncomeCents), icon: "ri-money-dollar-circle-line", color: "#f59e0b" },
            { label: "قيمة الأكواد المستخدمة", value: centsToEGP(usedVoucherCents), icon: "ri-coupon-3-line", color: "#8b5cf6" },
            { label: "جلسات قادمة", value: upcomingLives, icon: "ri-live-line", color: "#ef4444" },

            // NEW KPIs
            ...(centersStudents?.totalCenters
              ? [{ label: "إجمالي السناتر", value: centersStudents.totalCenters, icon: "ri-building-2-line", color: "#0ea5e9" }]
              : []),

            ...(attendanceAgg?.attendanceThisMonth != null
              ? [{ label: "حضور الشهر", value: attendanceAgg.attendanceThisMonth, icon: "ri-calendar-check-line", color: "#22c55e" }]
              : []),

            ...(checkoutNotifications?.pendingCount != null
              ? [{ label: "طلبات دفع معلّقة", value: checkoutNotifications.pendingCount, icon: "ri-alarm-warning-line", color: "#f97316" }]
              : []),
          ],
          recentActivity: mergedActivities,

          // NEW sections
          centers: {
            totalCenters: centersStudents?.totalCenters || 0,
            studentsByCenter: centersStudents?.studentsByCenter || [],
          },
          attendance: {
            startOfMonth: toIsoSafe(startOfMonth),
            attendanceThisMonth: attendanceAgg?.attendanceThisMonth || 0,
            uniqueStudentsThisMonth: attendanceAgg?.uniqueStudentsThisMonth || 0,
            attendanceByCenter: attendanceAgg?.attendanceByCenter || [],
          },
          checkoutNotifications: {
            pendingCount: checkoutNotifications?.pendingCount || 0,
            latest: checkoutNotifications?.latest || [],
          },
        },
      });
    } catch (e) {
      console.error("Dashboard Stats Error:", e);
      return res.status(500).json({
        success: false,
        message: "Dashboard stats failed",
        error: String(e?.message || e),
      });
    }
  });

  // ✅ GET student performance summary (admin/supervisor/center_manager)
  router.get("/admin/student-performance/:id", requireAuth, requireRole("admin", "supervisor", "center_manager"), async (req, res, next) => {
    try {
      const studentId = Number(req.params.id);
      if (!studentId) return res.status(400).json({ success: false, message: "studentId مطلوب" });

      const student = await StudentModel.findByPk(studentId);
      if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

      // 1) Total published lessons in student's grade
      const totalLessons = await LessonModel.count({
        where: { kind: 'lesson', isDeleted: false, status: 'published' },
        include: [{
          model: CourseModel,
          as: 'course',
          where: { level: student.year, isDeleted: false },
          required: true
        }]
      });

      // 2) Attendance records
      const attendances = await StudentAttendanceModel.findAll({
        where: { studentId },
        attributes: ['attendedAt']
      });

      // 3) Exam attempts with titles
      const examAttempts = await ExamAttemptModel.findAll({
        where: { studentId, submittedAt: { [Op.ne]: null } },
        include: [{ 
          model: ExamModel, 
          as: 'exam', 
          attributes: ['title'],
          required: false 
        }],
        order: [['submittedAt', 'DESC']]
      });

      const avgExamScore = examAttempts.length > 0
        ? Math.round(examAttempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0) / examAttempts.length)
        : null;

      // 4) Progress stats with lesson titles
      const progressList = await StudentLessonProgressModel.findAll({
        where: { studentId },
        include: [{ 
          model: LessonModel, 
          as: 'lesson', 
          attributes: ['title', 'kind'],
          required: false 
        }],
        attributes: ['lessonId', 'fullyWatched', 'maxWatchedSec', 'durationSecCached', 'updatedAtLocal']
      });

      const fullyWatchedCount = progressList.filter(p => p.fullyWatched).length;
      const homeworksCount = progressList.filter(p => p.lesson?.kind === 'homework').length;
      const lecturesCount = progressList.filter(p => p.lesson?.kind === 'lesson' && p.fullyWatched).length;

      // 5) Calculate Active Days (Distinct dates)
      const activeDates = new Set();
      attendances.forEach(a => { if(a.attendedAt) activeDates.add(new Date(a.attendedAt).toISOString().split('T')[0]); });
      examAttempts.forEach(e => { if(e.submittedAt) activeDates.add(new Date(e.submittedAt).toISOString().split('T')[0]); });
      progressList.forEach(p => {
        if (p.updatedAtLocal) activeDates.add(new Date(p.updatedAtLocal).toISOString().split('T')[0]);
      });

      return res.json({
        success: true,
        data: {
          student: {
            id: student.id,
            studentName: student.studentName || student.name,
            year: student.year,
            centerId: student.centerId,
          },
          avgExamScore,
          examsCount: examAttempts.length,
          lecturesCount,
          homeworksCount,
          activeDays: activeDates.size,
          attendanceRate: totalLessons > 0 ? Math.round((attendances.length / totalLessons) * 100) : 0,
          courseProgress: totalLessons > 0 ? Math.round((fullyWatchedCount / totalLessons) * 100) : 0,
          
          recentExams: examAttempts.map(e => ({
            id: e.id,
            examTitle: e.exam?.title || 'امتحان عام',
            score: e.score,
            submittedAt: e.submittedAt
          })),

          lessonProgress: progressList.map(p => {
            const duration = p.durationSecCached || 1;
            const watched = p.maxWatchedSec || 0;
            return {
              lessonId: p.lessonId,
              lessonTitle: p.lesson?.title || 'محاضرة',
              watchPercentage: Math.min(100, Math.round((watched / duration) * 100)),
              fullyWatched: p.fullyWatched,
              updatedAt: p.updatedAtLocal
            };
          }).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        }
      });
    } catch (e) {
      console.error("Student Performance Error:", e);
      next(e);
    }
  });

  router.get('/revenue-trend', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
    try {
      const labels = [];
      const data = [];
      const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      
      const priceField = pickAttr(PlanModel, ["priceCents", "price", "amountCents"]);
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        labels.push(monthsAr[d.getMonth()]);
        
        let monthTotalCents = 0;
        
        if (SubscriptionModel && PlanModel && planAssoc && subStartField && priceField) {
          const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const rows = await SubscriptionModel.findAll({
            where: { [subStartField]: { [Op.between]: [startOfMonth, endOfMonth] } },
            include: [{
              association: planAssoc,
              required: true,
              attributes: [priceField],
            }],
          });
          
          for (const sub of rows) {
            const plan = sub?.[planAssoc.as];
            monthTotalCents += Number(plan?.[priceField] || 0);
          }
        }
        
        data.push(Math.round(monthTotalCents / 100));
      }

      return res.json({
        success: true,
        data: {
          labels,
          datasets: [
            {
              label: 'الإيرادات (ج.م)',
              data,
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: true,
              tension: 0.4
            }
          ]
        }
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  router.get('/student-growth', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
    try {
      const labels = [];
      const data = [];
      const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        labels.push(monthsAr[d.getMonth()]);
        
        let count = 0;
        if (StudentModel && studentCreatedField) {
          const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
          
          count = await StudentModel.count({
            where: { [studentCreatedField]: { [Op.between]: [startOfMonth, endOfMonth] } }
          });
        }
        data.push(count);
      }

      return res.json({
        success: true,
        data: {
          labels,
          datasets: [
            {
              label: 'الطلاب الجدد',
              data,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.4
            }
          ]
        }
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  return router;
}
