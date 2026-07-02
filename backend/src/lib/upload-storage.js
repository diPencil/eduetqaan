// src/utils/upload-storage.js
import fs from 'fs';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import r2Client from '../lib/r2-client.js';

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local';

// Local settings
const UPLOADS_DIR = path.resolve('public', 'uploads');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// R2 settings
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

/**
 * Upload generic file to current storage driver (R2 or local).
 * @param {Buffer} buffer
 * @param {string} key - path inside bucket or uploads folder, e.g. 'geo/maps/sec3/arab-world-123.png'
 * @param {string} [contentType]
 * @returns {Promise<{driver: 'r2' | 'local', key: string, url: string}>}
 */
export async function uploadFileToStorage(buffer, key, contentType) {
  if (STORAGE_DRIVER === 'r2') {
    if (!r2Client || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
      throw new Error(
        '[R2] STORAGE_DRIVER=r2 لكن إعدادات R2 ناقصة (client/bucket/public base url)'
      );
    }

    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    });

    await r2Client.send(cmd);

    const base = R2_PUBLIC_BASE_URL.replace(/\/$/, '');
    const url = `${base}/${key}`;

    return {
      driver: 'r2',
      key,
      url,
    };
  }

  // === local fallback (dev) ===
  const fullPath = path.join(UPLOADS_DIR, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);

  const base = PUBLIC_BASE_URL.replace(/\/$/, '');
  const url = `${base}/uploads/${key}`;

  return {
    driver: 'local',
    key,
    url,
  };
}
