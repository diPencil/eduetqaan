// Disable AWS EC2 Metadata lookup locally to prevent MetadataLookupWarning
process.env.AWS_EC2_METADATA_DISABLED = 'true';

// Silence annoying GCP MetadataLookupWarning
const originalEmit = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (warning && warning.name === 'MetadataLookupWarning') return;
  if (typeof warning === 'string' && warning.includes('MetadataLookupWarning')) return;
  return originalEmit.call(this, warning, ...args);
};

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const ENV = {
  PORT: process.env.PORT || 3000,

  MYSQL_DB: process.env.MYSQL_DB || 'Samy_db',
  MYSQL_USER: process.env.MYSQL_USER || 'root',
  MYSQL_PASS: process.env.MYSQL_PASS || '',
  MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
  MYSQL_PORT: Number(process.env.MYSQL_PORT || 3306),

  SQLITE_DIR: process.env.SQLITE_DIR || './data',
  SQLITE_FILE: process.env.SQLITE_FILE || 'local.sqlite',

  SYNC_INTERVAL_MS: Number(process.env.SYNC_INTERVAL_MS || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // App Versions & Kill Switch
  MIN_APP_VERSION_ANDROID: Number(process.env.MIN_APP_VERSION_ANDROID || 8),
  MIN_APP_VERSION_IOS: Number(process.env.MIN_APP_VERSION_IOS || 8),
  MIN_APP_VERSION_DESKTOP: Number(process.env.MIN_APP_VERSION_DESKTOP || 8),

  REQUIRED_PLAYER_PROTOCOL: Number(process.env.REQUIRED_PLAYER_PROTOCOL || 3),
  KILL_SWITCH_ENABLED: process.env.KILL_SWITCH_ENABLED === 'true',

  // Security Flags
  PROTECT_YOUTUBE_VIDEOS: process.env.PROTECT_YOUTUBE_VIDEOS !== 'false',
  SESSION_SECRET: process.env.VIDEO_SESSION_SECRET || process.env.SESSION_SECRET || 'v-session-secret-123',
  PLAYBACK_TOKEN_SECRET: process.env.PLAYBACK_TOKEN_SECRET || process.env.PLAYBACK_SECRET || process.env.JWT_SECRET || 'change-this-secret-in-production',
};
