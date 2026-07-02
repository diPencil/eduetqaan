// src/server.js
import { ENV } from "./config/env.js";
import { initApp } from "./app.js";
import { initDatabases, getMysql, getSqlite } from "./config/db.js";
import { registerModels } from "./models/index.js";
import { buildModelsMap } from "./stores.js";
import { startPeriodicSync } from "./services/sync-worker.js";
import { startPeriodicPull } from "./services/pull-worker.js";
import { initSocket } from "./services/socket.service.js";
import { fileURLToPath } from 'url';

// Disable AWS EC2 Metadata lookup locally to prevent MetadataLookupWarning
process.env.AWS_EC2_METADATA_DISABLED = 'true';
import bcrypt from 'bcryptjs';

/**
 * Start function for the backend.
 * Can be called from Electron or directly via CLI.
 */
export const start = async (options = {}) => {
  const PORT = Number(options.port || process.env.PORT || 12011);
  
  try {
    // If we're passed a database path from Electron, we could inject it here
    // For now, we'll rely on global state or ENV
    
    await initDatabases();

    const models = registerModels();
    const modelsMap = buildModelsMap(models);

    const mysql = getMysql();
    const sqlite = getSqlite();

    // 1. Sync SQLite first (Fresh start for sync consistency)
    try {
      await sqlite.query('PRAGMA foreign_keys = OFF');
      // Drop index manually as Sequelize SQLite dialect sometimes fails to drop it during force:true
      await sqlite.query('DROP INDEX IF EXISTS lessons_kind');
      await sqlite.sync({ force: true });
      await sqlite.query('PRAGMA foreign_keys = ON');
      // console.log("✅ SQLite schema synced (Fresh start)");
    } catch (err) {
      console.warn("⚠️ SQLite schema sync encountered an issue (some indexes/tables might be skipped):", err.message);
    }

    // 2. Cleanup orphan enrollments on MySQL (Optional/Stable)
    try {
      // console.log("🧹 Cleaning up orphan enrollments...");
      await mysql.query("SET FOREIGN_KEY_CHECKS = 0");
      await mysql.query("DELETE FROM enrollments WHERE studentId NOT IN (SELECT id FROM students)");
      await mysql.query("DELETE FROM enrollments WHERE courseId NOT IN (SELECT id FROM courses)");
      await mysql.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (err) {
      console.warn("⚠️ Could not cleanup orphan enrollments:", err.message);
    }

    // 3. Sync MySQL schema (Resilient)
    try {
      // console.log("🔄 Syncing MySQL schema...");
      await mysql.query("SET FOREIGN_KEY_CHECKS = 0");
      await mysql.sync({ alter: true });
      await mysql.query("SET FOREIGN_KEY_CHECKS = 1");
      // console.log("✅ MySQL schema synced");
    } catch (err) {
      // console.error("⚠️ MySQL Sync Failed (Database missing or unreachable):", err.message);
      // console.log("ℹ️ Server will continue in OFFLINE mode (SQLite only).");
    }

    // 4. Start workers
    startPeriodicSync(modelsMap, ENV.SYNC_INTERVAL_MS || 5000);
    startPeriodicPull(modelsMap, 60000); // 1 minute pull

    // 5. Bootstrap default admin if no users exist
    try {
      const User = models.User || models.UserMysql;
      if (User) {
        const count = await User.count();
        if (count === 0) {
          console.log("👤 No users found. Creating default admin account...");
          const passwordHash = bcrypt.hashSync('admin123', 10);
          await User.create({
            email: 'admin@admin.com',
            passwordHash,
            role: 'admin',
            isActive: true,
            name: 'Admin',
            updatedAtLocal: new Date()
          });
          console.log("✅ Default admin created: admin@admin.com / admin123");
        }
      }
    } catch (err) {
      console.warn("⚠️ Could not bootstrap default admin:", err.message);
    }

    const app = await initApp(models, modelsMap);

    return new Promise((resolve, reject) => {
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 etqan backend listening on port ${PORT}`);
        // console.log(`🔁 Sync Workers Active (Push: ${ENV.SYNC_INTERVAL_MS || 5000}ms, Pull: 60000ms)`);
        
        // Initialize Socket.io
        initSocket(server);
        
        resolve(server);
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`⚠️ Port ${PORT} is already in use. Likely another instance is running.`);
          resolve(null); // Resolve anyway to let Electron continue
        } else {
          reject(err);
        }
      });
    });
  } catch (e) {
    console.error("❌ Failed to start backend:", e);
    throw e;
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun || process.env.START_DIRECTLY === 'true') {
  start();
}
