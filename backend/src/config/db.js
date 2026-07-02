// src/config/db.js
import { Sequelize } from 'sequelize';
import { ENV } from './env.js';
import path from 'path';
import fs from 'fs';

let mysql;
let sqlite;

/**
 * Registry for dynamic overrides (useful for Electron)
 */
const configOverrides = {
  sqliteStorage: null
};

export function setDbConfig(overrides = {}) {
  if (overrides.sqliteStorage) configOverrides.sqliteStorage = overrides.sqliteStorage;
}

/* ---------- MySQL ---------- */
function makeMysql() {
  return new Sequelize(ENV.MYSQL_DB, ENV.MYSQL_USER, ENV.MYSQL_PASS, {
    host: ENV.MYSQL_HOST,
    port: Number(ENV.MYSQL_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  });
}

/* ---------- SQLite ---------- */
function makeSqlite() {
  // Use override if provided (e.g. from Electron), else use ENV
  const dbPath = configOverrides.sqliteStorage || path.join(ENV.SQLITE_DIR, ENV.SQLITE_FILE);
  
  // Ensure parent directories exist for the SQLite db file
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // console.log(`[DB] initializing SQLite at: ${dbPath}`);

  return new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Cleaner logs for desktop
    pool: {
      max: 5,
      idle: 1000,
    },
    dialectOptions: {
      busyTimeout: 10000,
      pragmas: {
        foreign_keys: 0
      }
    },
    hooks: {
      afterConnect: (connection) => {
        connection.run('PRAGMA journal_mode=WAL;');
        connection.run('PRAGMA foreign_keys=OFF;');
      }
    }
  });
}

/* ---------- Init ---------- */
export async function initDatabases() {
  mysql = makeMysql();
  sqlite = makeSqlite();

  try {
    await sqlite.authenticate();
    // console.log('✅ SQLite ready');
  } catch (e) {
    console.error('❌ SQLite connection failed:', e.message);
  }

  try {
    await mysql.authenticate();
    // console.log('✅ MySQL ready');
  } catch (e) {
    console.warn('⚠️ MySQL connection failed (Starting in Offline mode):', e.message);
  }
}

export function getMysql() {
  if (!mysql) throw new Error('MySQL not initialized');
  return mysql;
}

export function getSqlite() {
  if (!sqlite) throw new Error('SQLite not initialized');
  return sqlite;
}

export async function isMysqlUp() {
  try {
    await getMysql().authenticate();
    return true;
  } catch {
    return false;
  }
}
