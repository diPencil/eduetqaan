import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

import QRCode from "qrcode";
import path from "path";
import fs from "fs";



// ==========================
// State
// ==========================
let qrCodeUrl = null;
let clientReady = false;
let client = null;

let initializationStatus = "idle"; // idle|initializing|waiting_qr|authenticated|ready|error
let initializationError = null;

let initTimeout = null;
let authWatchdog = null;
let statePoll = null;

let lastWaState = null;
let lastEventAt = null;

// ==========================
// Process-level diagnostics removed to prevent global spam

// ==========================
// Helpers
// ==========================
function touch(eventName) {
  lastEventAt = new Date().toISOString();
  // console.log(`🧭 [WA] ${eventName} @ ${lastEventAt}`);
}

function setStatus(newStatus) {
  const finalStatus = clientReady ? "ready" : newStatus;

  if (initializationStatus !== finalStatus) {
    console.log(
      `📡 [WhatsApp Service] Status Transition: ${initializationStatus} -> ${finalStatus}`,
    );
  }
  initializationStatus = finalStatus;
  touch(`status:${finalStatus}`);
}

function normalizePhoneToChatId(phone) {
  if (!phone) throw new Error("phone is required");

  let clean = String(phone).trim().replace(/[^\d]/g, "");

  // Egypt normalize: 01xxxxxxxxx -> 20xxxxxxxxxx
  if (clean.startsWith("01") && clean.length === 11) {
    clean = "20" + clean.substring(1);
  }

  if (clean.length < 8) throw new Error("Invalid phone number");
  return `${clean}@c.us`;
}

function startStatePolling() {
  if (statePoll) clearInterval(statePoll);

  statePoll = setInterval(async () => {
    try {
      if (!client) return;

      const s = await client.getState(); // CONNECTED / OPENING / UNPAIRED / ...
      lastWaState = s;
      touch(`getState:${s}`);

      if (s === "CONNECTED" && !clientReady) {
        clientReady = true;
        initializationError = null;
        qrCodeUrl = null;
        setStatus("ready");
        console.log("✅ [WhatsApp] getState()=CONNECTED => READY");
      }
    } catch {
      // ignore
    }
  }, 2500);
}

// ==========================
// Cleanup
// ==========================
async function gracefulDestroy() {
  if (authWatchdog) {
    clearTimeout(authWatchdog);
    authWatchdog = null;
  }
  if (initTimeout) {
    clearTimeout(initTimeout);
    initTimeout = null;
  }
  if (statePoll) {
    clearInterval(statePoll);
    statePoll = null;
  }

  if (client) {
    try {
      console.log("🔌 [WhatsApp] Graceful shutdown...");

      if (typeof client.removeAllListeners === "function") {
        client.removeAllListeners();
      }

      if (typeof client.destroy === "function") {
        await client.destroy();
        console.log("✅ [WhatsApp] Client destroyed.");
      }
    } catch (err) {
      console.error("⚠️ [WhatsApp] Destroy error:", err?.message);
    } finally {
      client = null;
    }
  }

  clientReady = false;
  qrCodeUrl = null;
  initializationError = null;
  lastWaState = null;

  setStatus("idle");
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n⚠️ [WhatsApp] Received ${signal}. Cleaning up...`);
    await gracefulDestroy();
    process.exit(0);
  });
});

// ==========================
// Public API
// ==========================
export function initWhatsAppClient() {
  if (client) {
    console.log("⚠️ [WhatsApp] Already initialized/in process.");
    return { success: true, message: "Client already initialized" };
  }

  console.log("🚀 [WhatsApp] Starting Initialization...");

  setStatus("initializing");
  initializationError = null;
  qrCodeUrl = null;
  clientReady = false;

  const sessionPath = path.resolve("./whatsapp-session");
  console.log(`📂 [WhatsApp] Session Path: ${sessionPath}`);

  try {
    const defaultChrome =
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/google-chrome-stable";

    const executablePath = process.env.CHROME_PATH || defaultChrome;
    const pathExists = executablePath && fs.existsSync(executablePath);

    // ✅ Windows default: headless=false لتفادي stuck authenticated/ready
    const headless =
      process.env.WA_HEADLESS != null
        ? String(process.env.WA_HEADLESS).toLowerCase() !== "false"
        : process.platform !== "win32";

    const launch = {
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
      ],
    };

    if (pathExists) {
      console.log(`✅ [WhatsApp] Using Chrome at: ${executablePath}`);
      launch.executablePath = executablePath;
    } else {
      console.warn("⚠️ [WhatsApp] Chrome path not found. Let Puppeteer choose.");
    }

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionPath,
        clientId: "session-1",
      }),

      // ✅ IMPORTANT: لا تستخدم LocalWebCache هنا لأنه بيكسر مع تغيّر WA Web
      // سيبها default بدون webVersionCache

      puppeteer: launch,
    });

    // Start polling state ASAP
    startStatePolling();

    initTimeout = setTimeout(async () => {
      if (!clientReady && !qrCodeUrl) {
        console.error("⏱️ [WhatsApp] Init Timeout (no QR & not ready).");
        setStatus("error");
        initializationError =
          "Timeout: WhatsApp لم يصل لحالة جاهزة. غالباً مشكلة WA Web/Headless.";
        await gracefulDestroy();
      }
    }, 120000);

    client.on("qr", async (qr) => {
      console.log("✨ [WhatsApp] QR Code Received!");
      setStatus("waiting_qr");
      try {
        qrCodeUrl = await QRCode.toDataURL(qr);
        clientReady = false;
        touch("qr");
      } catch (err) {
        console.error("❌ [WhatsApp] QR Error:", err);
        initializationError = "فشل في توليد QR Code";
        setStatus("error");
      }
    });

    client.on("authenticated", () => {
      console.log("🔐 [WhatsApp] Authenticated");
      setStatus("authenticated");

      if (authWatchdog) clearTimeout(authWatchdog);
      authWatchdog = setTimeout(async () => {
        // لو statePoll ماجابش CONNECTED خلال 90s
        if (!clientReady) {
          console.error("⏱️ [WhatsApp] Authenticated but never became READY.");
          setStatus("error");
          initializationError =
            "Authenticated لكن لم يصل READY. جرّب WA_HEADLESS=false + Logout كامل.";
          await gracefulDestroy();
        }
      }, 90000);
    });

    client.on("ready", () => {
      console.log("✅ [WhatsApp] Client is READY!");
      clientReady = true;
      qrCodeUrl = null;
      initializationError = null;
      setStatus("ready");

      if (authWatchdog) clearTimeout(authWatchdog);
      authWatchdog = null;

      if (initTimeout) clearTimeout(initTimeout);
      initTimeout = null;

      touch("ready");
    });

    client.on("change_state", (state) => {
      lastWaState = state;
      console.log("🧩 [WhatsApp] State:", state);

      if (state === "CONNECTED" && !clientReady) {
        clientReady = true;
        initializationError = null;
        setStatus("ready");
      }

      touch(`state:${state}`);
    });

    client.on("loading_screen", (percent, message) => {
      console.log(`📊 [WhatsApp] Loading: ${percent}% - ${message}`);
      if (initializationStatus !== "authenticated" && initializationStatus !== "ready") {
        setStatus("initializing");
      }
      touch("loading_screen");
    });

    client.on("auth_failure", (msg) => {
      console.error("❌ [WhatsApp] Auth Failure:", msg);
      initializationError = `فشل المصادقة: ${msg}`;
      setStatus("error");
    });

    client.on("disconnected", async (reason) => {
      console.log("🔌 [WhatsApp] Disconnected:", reason);
      initializationError = `Disconnected: ${reason}`;
      setStatus("error");
      await gracefulDestroy();
    });

    console.log("⏳ [WhatsApp] Calling client.initialize()...");
    client.initialize().then(
      () => console.log("🎉 [WhatsApp] Initialize resolved."),
      async (err) => {
        console.error("❌ [WhatsApp] Init Error:", err?.message);
        initializationError = `فشل التهيئة: ${err?.message}`;
        setStatus("error");
        await gracefulDestroy();
      },
    );

    return { success: true, message: "Initialization started" };
  } catch (error) {
    console.error("❌ [WhatsApp] Critical Init Error:", error?.message);
    initializationError = error?.message || "Critical init error";
    setStatus("error");
    client = null;
    return { success: false, error: initializationError };
  }
}

export function getClientStatus() {
  const status = clientReady ? "ready" : initializationStatus;
  return {
    ready: clientReady,
    qrCode: qrCodeUrl,
    isInitialized: !!client,
    status,
    error: initializationError,
    waState: lastWaState,
    lastEventAt,
  };
}

export async function logoutWhatsAppClient() {
  const sessionPath = path.resolve("./whatsapp-session");
  console.log("🚪 [WhatsApp] Full logout...");

  await gracefulDestroy();

  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log(`🗑️ [WhatsApp] Session deleted: ${sessionPath}`);
  }

  return { success: true, message: "تم تسجيل الخروج وحذف الجلسة." };
}

export async function sendDirectMessage(phone, message) {
  if (!clientReady || !client) throw new Error("WhatsApp client not ready");
  if (!message) throw new Error("message is required");

  const chatId = normalizePhoneToChatId(phone);
  await client.sendMessage(chatId, String(message));
  return true;
}

export async function startCampaignService(
  studentsList,
  messageTemplate,
  campaignRecord,
  config,
  LogModel,
) {
  if (!clientReady || !client) throw new Error("WhatsApp client not ready");

  const list = Array.isArray(studentsList) ? studentsList : [];
  const template = String(messageTemplate || "");

  const BATCH_SIZE = Number(config?.batchSize) || 5;
  const DELAY_SECONDS = Number(config?.batchDelay) || 10;

  if (campaignRecord) {
    campaignRecord.status = "RUNNING";
    campaignRecord.totalTargeted = list.length;
    campaignRecord.batchSize = BATCH_SIZE;
    campaignRecord.batchDelay = DELAY_SECONDS;
    await campaignRecord.save();
  }

  let sentCount = 0;
  let failedCount = 0;

  (async () => {
    for (let i = 0; i < list.length; i++) {
      const student = list[i];

      const msg = template
        .replace("{{name}}", student?.studentName || "")
        .replace("{{code}}", student?.centerCode || "")
        .replace("{{center}}", student?.centerName || "");

      let logStatus = "SUCCESS";
      let errorReason = null;

      try {
        if (!clientReady || !client) throw new Error("Client disconnected");
        await sendDirectMessage(student?.studentPhone, msg);
        sentCount++;
      } catch (error) {
        failedCount++;
        logStatus = "FAILED";

        const errMsg = error?.message || String(error);
        if (errMsg.includes("Timeout")) errorReason = "انتهت مهلة الإرسال";
        else if (errMsg.includes("not a registered"))
          errorReason = "الرقم غير مسجل";
        else errorReason = `فشل: ${errMsg.substring(0, 80)}`;
      }

      if (campaignRecord && LogModel) {
        try {
          await LogModel.create({
            campaignId: campaignRecord.id,
            studentId: student?.id,
            studentName: student?.studentName,
            studentPhone: student?.studentPhone,
            status: logStatus,
            errorReason,
            createdAtLocal: new Date(),
          });
        } catch (dbErr) {
          console.error("DB Log Error:", dbErr?.message);
        }
      }

      const isBatchComplete = (i + 1) % BATCH_SIZE === 0;
      const isLastStudent = i === list.length - 1;

      if (isBatchComplete && !isLastStudent) {
        console.log(`⏳ Batch complete. Waiting ${DELAY_SECONDS}s...`);
        await new Promise((r) => setTimeout(r, DELAY_SECONDS * 1000));
      } else {
        const randomDelay = Math.floor(Math.random() * 2000) + 1000;
        await new Promise((r) => setTimeout(r, randomDelay));
      }
    }

    if (campaignRecord) {
      campaignRecord.status = "COMPLETED";
      campaignRecord.successCount = sentCount;
      campaignRecord.failedCount = failedCount;
      await campaignRecord.save();
    }

    console.log(`✅ [Campaign] Completed. success=${sentCount} failed=${failedCount}`);
  })();

  return { status: "Campaign Started", total: list.length };
}
