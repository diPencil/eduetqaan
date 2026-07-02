import crypto from 'crypto';
import { ENV } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';
const SECRET = ENV.PLAYBACK_SECRET || ENV.JWT_SECRET || 'fallback-secret-for-id-hashing-123';

// Derive a 32-byte key from the secret
const KEY = crypto.scryptSync(SECRET, 'salt-for-key', 32);
// Use a fixed 16-byte IV for deterministic output (same ID -> same hash)
const IV = crypto.scryptSync(SECRET, 'salt-for-iv', 16);

/**
 * Encodes a numeric ID into a secure string.
 * @param {number|string} id 
 * @returns {string}
 */
export function encodeId(id) {
    if (!id) return '';
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(String(id), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Convert hex to base64url to make it shorter and URL-safe
    return Buffer.from(encrypted, 'hex').toString('base64url');
}

/**
 * Decodes a secure string back into a numeric ID.
 * @param {string} hash 
 * @returns {number|null}
 */
export function decodeId(hash) {
    if (!hash) return null;
    try {
        // Convert base64url back to hex
        const encrypted = Buffer.from(hash, 'base64url').toString('hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        const id = Number(decrypted);
        return isNaN(id) ? null : id;
    } catch (err) {
        return null;
    }
}
