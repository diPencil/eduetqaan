// src/routes/wallet.routes.js
import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * كل ما يخص محفظة الطالب: الرصيد، الحركات، شاشة الإدارة، و ShakePay (ديمو)
 */
export default function createWalletRouter(models) {
  const router = Router();
  const dev = process.env.NODE_ENV !== 'production';

  const {
    WalletMysql,
    WalletTxMysql,
    TopupMysql,
    Wallet,
    WalletTx,
    Topup,
  } = models;

  // موديلات موحدة (تشتغل سواء عندك Mysql أو اسم عادي)
  const WalletModel =
    WalletMysql ||
    Wallet ||
    models.WalletMysql ||
    models.Wallet ||
    null;

  const WalletTxModel =
    WalletTxMysql ||
    WalletTx ||
    models.WalletTxMysql ||
    models.WalletTx ||
    null;

  const TopupModel =
    TopupMysql ||
    Topup ||
    models.TopupMysql ||
    models.Topup ||
    models.WalletTopup ||
    null;

  const StudentModel = models.StudentMysql || models.Student || null;
  const CenterModel = models.CenterMysql || models.Center || null;

  if (!WalletModel) {
    // ده critical: لازم يكون في جدول wallets
    throw new Error('Wallet model (Wallet / WalletMysql) is not configured');
  }

  const getAttrs = (M) => (M?.getAttributes?.() || M?.rawAttributes || {});

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  // تأكيد وجود محفظة للطالب أو إنشائها
  async function ensureWallet(studentId) {
    const Wallet = WalletModel;
    const attrs = getAttrs(Wallet);
    const { StudentMysql, Student } = models;
    const StudentModelRef = StudentMysql || Student;

    let wallet = null;
    if (Wallet?.findOne) {
      wallet = await Wallet.findOne({ where: { studentId } });
    }

    if (!wallet) {
      const data = { studentId };
      if ('balanceCents' in attrs) data.balanceCents = 0;
      if ('updatedAtLocal' in attrs) data.updatedAtLocal = new Date();

      if (!Wallet?.create) {
        throw new Error('Wallet model does not support create()');
      }

      // Check if student exists before creating wallet to avoid FK errors
      if (StudentModelRef) {
        const studentExists = await StudentModelRef.findByPk(studentId);
        if (!studentExists) {
          throw new Error('الطالب غير موجود. لا يمكن إنشاء محفظة.');
        }
      }

      wallet = await Wallet.create(data);
    }

    return wallet;
  }

  // طرق الشحن المسموح بها في TopupRequest
  const ALLOWED_TOPUP_METHODS = [
    'instapay',
    'wallet_transfer',
    'bank_transfer',
    'cash',
    'shakepay',
  ];

  // -----------------------------------------------------------------------
  // GET /wallet/me  => محفظة الطالب + آخر 20 حركة
  // -----------------------------------------------------------------------
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const wallet = await ensureWallet(studentId);

      let txs = [];
      if (WalletTxModel?.findAll) {
        txs = await WalletTxModel.findAll({
          where: { walletId: wallet.id },
          order: [['id', 'DESC']],
          limit: 20,
        });
      }

      res.json({
        success: true,
        data: { wallet, recent: txs },
      });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------------------------------------------------
  // POST /wallet/topup-intent  => تسجيل طلب شحن (TopupModel لازم يكون موجود)
  // -----------------------------------------------------------------------
  router.post('/topup-intent', requireAuth, async (req, res, next) => {
    try {
      const { amountCents, method, transferRef, proofUrl, notes } =
        req.body || {};

      if (!amountCents || amountCents < 1000) {
        return res.status(400).json({
          success: false,
          message: 'القيمة غير صالحة (أقل من 10 جنيه)',
        });
      }

      if (!ALLOWED_TOPUP_METHODS.includes(method)) {
        return res
          .status(400)
          .json({ success: false, message: 'طريقة الشحن غير معروفة' });
      }

      if (!TopupModel?.create) {
        return res.status(500).json({
          success: false,
          message: 'جدول طلبات الشحن غير مهيأ',
        });
      }

      const now = new Date();

      const data = {
        studentId: req.user.id,
        amountCents,
        method,
        transferRef: transferRef || null,
        proofUrl: proofUrl || null,
        notes: notes || null,
        status: 'pending',
        createdAt: now,
        updatedAtLocal: now,
      };

      const created = await TopupModel.create(data);

      res.json({
        success: true,
        message: 'تم تسجيل طلب الشحن بنجاح، سيتم مراجعته قريبًا',
        data: created,
      });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------------------------------------------------
  // POST /wallet/redeem-code  => شحن بكود داخلي (للديف/الدعم)
  // WalletTxModel هنا اختياري، لو مش موجود هنكتفي بتعديل الرصيد
  // -----------------------------------------------------------------------
  router.post('/redeem-code', requireAuth, requireRole('admin', 'supervisor', 'center_manager', 'user'), async (req, res) => {
    try {
      const code = String(req.body?.code || '').trim();
      if (!code || code.length < 4) {
        return res
          .status(400)
          .json({ success: false, message: 'كود غير صالح' });
      }

      const studentId = req.user?.id;
      if (!studentId) {
        return res
          .status(401)
          .json({ success: false, message: 'غير مصرح — لا يوجد مستخدم' });
      }

      const Wallet = WalletModel;
      const WalletTx = WalletTxModel; // ممكن يكون null

      const WAttrs = getAttrs(Wallet);
      const TAttrs = getAttrs(WalletTx);

      let wallet = await Wallet.findOne({ where: { studentId } });
      if (!wallet) {
        const wData = { studentId };
        if ('balanceCents' in WAttrs) wData.balanceCents = 0;
        if ('updatedAtLocal' in WAttrs) wData.updatedAtLocal = new Date();
        wallet = await Wallet.create(wData);
      }

      const amountCents = Number.isFinite(Number(req.body?.amountCents))
        ? Number(req.body.amountCents)
        : 5000;
      if (amountCents < 100) {
        return res
          .status(400)
          .json({ success: false, message: 'قيمة الكود ضعيفة جدًا' });
      }

      const memo = `شحن بكود (${code.slice(0, 4)}…${code.slice(-2)})`;
      const now = new Date();

      // إنشاء حركة فقط لو جدول WalletTx موجود
      let tx = null;
      if (WalletTx?.create) {
        const txData = {};
        if ('walletId' in TAttrs) txData.walletId = wallet.id;
        if ('amountCents' in TAttrs) txData.amountCents = amountCents;
        if ('desc' in TAttrs) txData.desc = memo;
        else if ('description' in TAttrs) txData.description = memo;
        else if ('note' in TAttrs) txData.note = memo;
        else if ('reason' in TAttrs) txData.reason = memo;
        if ('createdAt' in TAttrs) txData.createdAt = now;
        if ('updatedAtLocal' in TAttrs) txData.updatedAtLocal = now;

        tx = await WalletTx.create(txData);
      }

      const newBalance = (Number(wallet.balanceCents) || 0) + amountCents;
      const upd = {};
      if ('balanceCents' in WAttrs) upd.balanceCents = newBalance;
      if ('updatedAtLocal' in WAttrs) upd.updatedAtLocal = now;
      if (Object.keys(upd).length) await wallet.update(upd);

      const resWallet = wallet.toJSON ? wallet.toJSON() : wallet;
      if ('balanceCents' in resWallet) {
        resWallet.balanceCents = newBalance;
      }

      return res.json({
        success: true,
        message: `تم شحن محفظتك بـ ${(amountCents / 100).toFixed(2)} جنيه.`,
        data: { wallet: resWallet, tx },
      });
    } catch (e) {
      const detail = {
        name: e?.name,
        message: e?.message,
        sql: e?.sql,
        sqlMessage: e?.original?.sqlMessage || e?.parent?.sqlMessage,
        sqlState: e?.original?.code || e?.parent?.code,
        fields: e?.fields,
        stack: dev ? e?.stack : undefined,
      };
      console.error('[wallet][redeem-code] ERROR:', detail);
      return res.status(500).json({
        success: false,
        message: 'فشل شحن الكود.',
        ...(dev ? { detail } : {}),
      });
    }
  });

  // -----------------------------------------------------------------------
  // GET /wallet/admin/students  => قائمة الطلاب + الرصيد (إدارة)
  // يدعم page + limit أو pageSize من الفرونت
  // -----------------------------------------------------------------------
  router.get(
    '/admin/students',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res, next) => {
      try {
        if (!StudentModel) {
          return res.status(500).json({
            success: false,
            message: 'جدول الطلاب غير مهيأ',
          });
        }

        // attributes بتاعة جدول الطلاب
        const SAttrs = getAttrs(StudentModel);

        const pageRaw = Number(req.query.page) || 1;
        const limitRaw = Number(req.query.limit) || 50;

        const page = Math.max(1, pageRaw);
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'staff' || req.user.role === 'user');
        const maxLimit = isAdmin ? 10000 : 200;
        const limit = Math.min(maxLimit, Math.max(1, limitRaw));
        const offset = (page - 1) * limit;

        const where = {};

        const level = req.query.level
          ? String(req.query.level).trim()
          : '';
        if (level) {
          where.year = level;
        }

        const centerId = req.query.centerId ? Number(req.query.centerId) : null;
        if (centerId) {
          where.centerId = centerId;
        }

        const region = req.query.region ? String(req.query.region).trim() : '';
        if (region) {
          where.region = { [Op.like]: `%${region}%` };
        }

        // ====== Date Filtering (Registration Period) ==========
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt[Op.gte] = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt[Op.lte] = end;
          }
        }

        // ====== البحث الذكي q (الاسم / الكود / التليفون بجميع صيغه) ==========
        let q = req.query.q ? String(req.query.q).trim() : '';
        if (q) {
          const or = [];

          // 1. تنظيف النص من المسافات وعلامة + إذا كان يشبه التليفون
          let digits = q.replace(/[^\d]/g, ''); 
          
          // 2. معالجة الصيغ المختلفة للهواتف المصرية
          let phoneVariations = [];
          if (digits.length >= 3) {
            // إضافة الرقم المستخرج الأصلي
            phoneVariations.push(digits);

            // لو بدأ بـ 20 (كود مصر)، نضيف النسخة اللي بتبدأ بـ 0 مباشرة
            if (digits.startsWith('20')) {
                const local = '0' + digits.substring(2);
                phoneVariations.push(local);
                // وأيضاً النسخة بدون الصفر الأول للأمان
                phoneVariations.push(digits.substring(2));
            }
            // لو بدأ بـ 1 (مثلاً 1027...)، نضيف النسخة اللي بتبدأ بـ 0
            else if (['10', '11', '12', '15'].includes(digits.substring(0, 2))) {
                phoneVariations.push('0' + digits);
            }
          }

          // الأعمدة اللي حابب نبحث فيها
          const searchFields = [
            'studentName',
            'centerCode',
            'studentPhone',
            'phone',
            'mobile',
            'whatsapp',
            'region'
          ];

          for (const field of searchFields) {
            if (field in SAttrs) {
              const fieldConditions = [
                { [Op.like]: `%${q}%` }
              ];
              
              // إضافة كل تنويعات الأرقام للبحث في هذه الخانة
              for (const v of phoneVariations) {
                if (v.length >= 3) {
                  fieldConditions.push({ [Op.like]: `%${v}%` });
                }
              }

              or.push({ [field]: { [Op.or]: fieldConditions } });
            }
          }

          if (or.length > 0) {
            where[Op.or] = or;
          }
        }

        const include = [];
        const hasBalance = req.query.hasBalance === 'true';

        if (WalletModel) {
          const walletInclude = {
            model: WalletModel,
            as: 'wallet',
            required: hasBalance, // Make inner join if filtering by balance
          };
          
          if (hasBalance) {
            walletInclude.where = {
              balanceCents: { [Op.gt]: 0 }
            };
          }
          
          include.push(walletInclude);
        }

        if (CenterModel) {
          include.push({
            model: CenterModel,
            as: 'center',
            required: false,
          });
        }

        const { rows, count } = await StudentModel.findAndCountAll({
          where,
          include,
          order: [['studentName', 'ASC']],
          limit,
          offset,
        });

        const students = rows.map((row) => {
          const j = row.toJSON ? row.toJSON() : row;
          const wallet = j.wallet || {};
          const center = j.center || {};

          const phone =
            j.studentPhone ||
            j.phone ||
            j.mobile ||
            j.whatsapp ||
            null;

          return {
            id: j.id,
            studentName: j.studentName || '',
            email: j.email || '',
            year: j.year || null,
            centerId: j.centerId ?? null,
            centerName: center?.name || null,
            centerCode: j.centerCode || null,
            region: j.region || center?.region || null,
            phone,
            studentPhone: j.studentPhone || phone,
            guardianPhone: j.guardianPhone || null,
            walletId: wallet?.id ?? null,
            balanceCents: Number(wallet?.balanceCents ?? 0),
            walletUpdatedAtLocal:
              wallet?.updatedAtLocal || wallet?.updatedAt || null,
          };
        });

        const totalPages = Math.max(1, Math.ceil(count / limit) || 1);

        return res.json({
          success: true,
          data: {
            students,
            pagination: {
              total: count,
              page,
              pageSize: limit,
              totalPages,
            },
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );


  // -----------------------------------------------------------------------
  // POST /wallet/admin/students/:studentId/adjust-balance (إدارة فقط)
  // يعدل رصيد محفظة الطالب + يسجل حركة لو WalletTxModel موجود
  // -----------------------------------------------------------------------
  router.post(
    '/admin/adjust-balance',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res) => {
      try {
        if (!WalletModel || !WalletTxModel) {
          return res.status(500).json({
            success: false,
            message: 'جداول المحفظة غير مهيأة',
          });
        }

        const studentId = Number(req.body?.studentId);

        // 🛡️ Security Check: Center Manager can only adjust students in their center
        if (req.user.role === 'center_manager' && req.user.centerId) {
          const student = await StudentModel.findByPk(studentId);
          if (student && Number(student.centerId) !== Number(req.user.centerId)) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية لتعديل رصيد هذا الطالب." });
          }
        }
        const amountCents = Number(req.body?.amountCents);
        const descRaw = req.body?.desc;

        if (!studentId || !Number.isFinite(amountCents) || amountCents === 0) {
          return res.status(400).json({
            success: false,
            message:
              'studentId و amountCents (≠ 0) مطلوبان لتعديل رصيد المحفظة',
          });
        }

        const desc =
          String(descRaw || '').trim() || 'تعديل رصيد يدوي من الإدارة';

        const wallet = await ensureWallet(studentId);

        const WAttrs = getAttrs(WalletModel);
        const TAttrs = getAttrs(WalletTxModel);
        const now = new Date();

        const txData = {};

        // relations / keys
        if ('walletId' in TAttrs) txData.walletId = wallet.id;
        if ('studentId' in TAttrs && !('walletId' in TAttrs)) {
          txData.studentId = studentId;
        }

        // amount + description
        if ('amountCents' in TAttrs) txData.amountCents = amountCents;
        if ('desc' in TAttrs) txData.desc = desc;
        else if ('description' in TAttrs) txData.description = desc;
        else if ('note' in TAttrs) txData.note = desc;
        else if ('reason' in TAttrs) txData.reason = desc;

        // timestamps
        if ('createdAt' in TAttrs) txData.createdAt = now;
        if ('updatedAtLocal' in TAttrs) txData.updatedAtLocal = now;

        // ===== NEW: type (NOT NULL) =====================================
        if ('type' in TAttrs) {
          const attr = TAttrs.type;
          // ENUM values لو موجودة
          const enumValues =
            attr?.values ||
            (attr?.type && Array.isArray(attr.type.values)
              ? attr.type.values
              : null);

          let txType = attr?.defaultValue || null;

          if (!txType && Array.isArray(enumValues) && enumValues.length) {
            const preferred = amountCents >= 0
              ? ['adjust', 'credit', 'topup', 'admin_adjust', 'manual_adjust']
              : ['adjust', 'debit', 'spend', 'admin_adjust', 'manual_adjust'];

            txType =
              preferred.find((v) => enumValues.includes(v)) || enumValues[0];
          }

          // لو مش ENUM أو مفيش default، نحط قيمة نصية ثابتة
          if (!txType) {
            txType =
              amountCents >= 0
                ? 'admin_adjust_credit'
                : 'admin_adjust_debit';
          }

          txData.type = txType;
        }

        const newBalance = (Number(wallet.balanceCents) || 0) + amountCents;

        // Store auditor info in meta
        txData.meta = { 
          adminId: req.user.id,
          adminName: req.user.name || req.user.email || 'Admin'
        };
        
        if ('balanceAfter' in TAttrs) {
          txData.balanceAfter = newBalance;
        }
        // ===============================================================

        const tx = await WalletTxModel.create(txData);

        const upd = {};
        if ('balanceCents' in WAttrs) upd.balanceCents = newBalance;
        if ('updatedAtLocal' in WAttrs) upd.updatedAtLocal = now;
        if (Object.keys(upd).length) {
          await wallet.update(upd);
        }

        const walletJson = wallet.toJSON ? wallet.toJSON() : wallet;
        walletJson.balanceCents = newBalance;
        if ('updatedAtLocal' in walletJson && upd.updatedAtLocal) {
          walletJson.updatedAtLocal = upd.updatedAtLocal;
        }

        return res.json({
          success: true,
          message: 'تم تعديل رصيد المحفظة بنجاح',
          data: {
            wallet: walletJson,
            tx,
          },
        });
      } catch (e) {
        console.error('[wallet][admin][adjust-balance] error:', e);
        return res.status(500).json({
          success: false,
          message: 'تعذر تعديل رصيد المحفظة',
        });
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /wallet/admin/students/:studentId => محفظة الطالب + الحركات
  // -----------------------------------------------------------------------
  router.get(
    '/admin/students/:studentId',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res, next) => {
      try {
        if (req.params.studentId === 'stats') {
          return next();
        }
        
        const studentId = Number(req.params.studentId);
        if (!studentId) {
          return res.status(400).json({ success: false, message: 'studentId مطلوب' });
        }

        // 🛡️ Security Check
        if (req.user.role === 'center_manager' && req.user.centerId) {
          const student = await StudentModel.findByPk(studentId);
          if (student && Number(student.centerId) !== Number(req.user.centerId)) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية لعرض محفظة هذا الطالب." });
          }
        }

        const wallet = await ensureWallet(studentId);
        let txs = [];
        if (WalletTxModel?.findAll) {
          txs = await WalletTxModel.findAll({
            where: { walletId: wallet.id },
            order: [['id', 'DESC']],
            limit: 20,
          });
        }

        return res.json({
          success: true,
          data: { wallet, recent: txs },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /wallet/admin/students/:studentId/transactions => سجل حركات طالب معين
  // -----------------------------------------------------------------------
  router.get(
    '/admin/students/:studentId/transactions',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res, next) => {
      try {
        const studentId = Number(req.params.studentId);
        if (!studentId) {
          return res.status(400).json({ success: false, message: 'studentId مطلوب' });
        }

        const wallet = await WalletModel.findOne({ where: { studentId } });
        if (!wallet) {
          return res.json({ success: true, data: [] });
        }

        // 🛡️ Security Check: Center Manager can only see transactions of students in their center
        if (req.user.role === 'center_manager' && req.user.centerId) {
          const student = await StudentModel.findByPk(studentId);
          if (student && Number(student.centerId) !== Number(req.user.centerId)) {
            return res.status(403).json({ success: false, message: "ليس لديك صلاحية لعرض حركات هذا الطالب." });
          }
        }

        const txs = await WalletTxModel.findAll({
          where: { walletId: wallet.id },
          order: [['id', 'DESC']],
          limit: 100,
        });

        return res.json({
          success: true,
          data: txs
        });
      } catch (e) {
        next(e);
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /wallet/admin/stats => إحصائيات عامة للمحفظة (إدارة)
  // -----------------------------------------------------------------------
  router.get(
    ['/admin/stats', '/admin/students/stats'],
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res) => {
      try {
        const totalBalance = await WalletModel.sum('balanceCents') || 0;
        const totalWallets = await WalletModel.count();
        const totalStudents = await StudentModel.count();
        
        // توزيع المراحل
        const byGradeRows = await StudentModel.findAll({
          attributes: ['year', [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']],
          group: ['year']
        });
        const byGrade = byGradeRows.map(r => ({
          year: r.year,
          count: r.get('count')
        }));

        // السناتر vs أونلاين
        const centerCount = await StudentModel.count({ where: { centerId: { [Op.ne]: null } } });
        const onlineCount = totalStudents - centerCount;

        let pendingTopups = 0;
        if (TopupModel) {
          pendingTopups = await TopupModel.count({ where: { status: 'pending' } });
        }

        return res.json({
          success: true,
          data: {
            totalBalanceCents: totalBalance,
            totalBalanceEGP: (totalBalance / 100).toFixed(2),
            totalWallets,
            totalStudents,
            byGrade,
            centerVsOnline: {
              center: centerCount,
              online: onlineCount
            },
            pendingTopupsCount: pendingTopups,
          },
        });
      } catch (e) {
        console.error('[wallet][admin][stats] error:', e);
        return res.status(500).json({ success: false, message: 'تعذر جلب إحصائيات المحفظة' });
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /wallet/admin/bulk-adjust => تعديل أرصدة مجموعة طلاب (إدارة)
  // body: { studentIds: [], amountCents: number, desc?: string }
  // -----------------------------------------------------------------------
  router.post(
    '/admin/bulk-adjust',
    requireAuth,
    requireRole('admin', 'supervisor', 'center_manager', 'user'),
    async (req, res) => {
      try {
        const { studentIds, amountCents, desc } = req.body || {};
        if (!Array.isArray(studentIds) || !studentIds.length || !amountCents) {
          return res.status(400).json({ success: false, message: 'بيانات غير صالحة' });
        }

        const description = String(desc || '').trim() || 'تعديل رصيد بالجملة من الإدارة';
        const now = new Date();
        const results = { successCount: 0, failCount: 0, errors: [] };

        for (const sid of studentIds) {
          try {
            const wallet = await ensureWallet(sid);
            const WAttrs = getAttrs(WalletModel);
            const TAttrs = getAttrs(WalletTxModel);

            // Create Transaction
            if (WalletTxModel) {
              const txData = {
                amountCents,
                desc: description,
                createdAt: now,
                updatedAtLocal: now,
              };
              if ('walletId' in TAttrs) txData.walletId = wallet.id;
              if ('studentId' in TAttrs && !('walletId' in TAttrs)) txData.studentId = sid;
              
              // Handle 'type' if present
              if ('type' in TAttrs) {
                txData.type = amountCents >= 0 ? 'credit' : 'debit';
              }
              if ('reason' in TAttrs) txData.reason = description;
              else if ('description' in TAttrs) txData.description = description;
              else if ('note' in TAttrs) txData.note = description;
              
              // Store auditor info in meta
              txData.meta = { 
                adminId: req.user.id,
                adminName: req.user.name || req.user.email || 'Admin'
              };
              
              await WalletTxModel.create(txData);
            }

            // Update Balance
            const newBalance = (Number(wallet.balanceCents) || 0) + amountCents;
            const upd = {};
            if ('balanceCents' in WAttrs) upd.balanceCents = newBalance;
            if ('updatedAtLocal' in WAttrs) upd.updatedAtLocal = now;
            await wallet.update(upd);

            results.successCount++;
          } catch (err) {
            results.failCount++;
            results.errors.push({ studentId: sid, error: err.message });
          }
        }

        return res.json({
          success: true,
          message: `تمت العملية بنجاح لـ ${results.successCount} طلاب، وفشل لـ ${results.failCount}`,
          data: results,
        });
      } catch (e) {
        console.error('[wallet][admin][bulk-adjust] error:', e);
        return res.status(500).json({ success: false, message: 'حدث خطأ أثناء التعديل بالجملة' });
      }
    }
  );
  // -----------------------------------------------------------------------
  // ShakePay (ديمو) - نفس اللي كان عندك
  // -----------------------------------------------------------------------

  router.post('/shakepay/confirm', requireAuth, async (req, res, next) => {
    try {
      const { amountCents, gatewayRef } = req.body || {};

      if (!amountCents || amountCents < 1000) {
        return res.status(400).json({
          success: false,
          message: 'القيمة غير صالحة (أقل من 10 جنيه)',
        });
      }

      if (!TopupModel?.create) {
        return res.status(500).json({
          success: false,
          message: 'جدول طلبات الشحن غير مهيأ',
        });
      }

      const now = new Date();

      const data = {
        studentId: req.user.id,
        amountCents,
        method: 'shakepay',
        transferRef: gatewayRef || null,
        proofUrl: null,
        notes: gatewayRef
          ? `ShakePay payment ref: ${gatewayRef}`
          : 'ShakePay payment',
        status: 'pending',
        createdAt: now,
        updatedAtLocal: now,
      };

      const created = await TopupModel.create(data);

      return res.json({
        success: true,
        message:
          'تم تسجيل عملية الدفع عبر ShakePay، وسيقوم فريق الدعم بإرسال كود الشحن قريبًا.',
        data: created,
      });
    } catch (e) {
      next(e);
    }
  });

  router.post('/shakepay/create-session', requireAuth, async (req, res) => {
    try {
      const { amountCents } = req.body || {};
      if (!amountCents || amountCents < 1000) {
        return res
          .status(400)
          .json({ success: false, message: 'الحد الأدنى 10 جنيه' });
      }

      const amountEGP = (amountCents / 100).toFixed(2);

      const redirectUrl =
        'https://shakepay.example.com/checkout/demo';

      return res.json({
        success: true,
        redirectUrl,
        message: `سيتم تحويلك للدفع بمبلغ ${amountEGP} جنيه عبر ShakePay`,
      });
    } catch (e) {
      console.error('[shakepay][create-session] error:', e);
      return res.status(500).json({
        success: false,
        message: 'تعذر إنشاء جلسة الدفع مع ShakePay',
      });
    }
  });

  return router;
}
