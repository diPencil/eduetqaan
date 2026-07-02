import crypto from 'crypto';
import { ENV } from '../config/env.js';

/**
 * Simple session token generator.
 * @param {string} studentId
 * @param {string} lessonId
 * @returns {string}
 */
export function generateSessionToken(studentId, lessonId) {
    const secret = ENV.SESSION_SECRET || 'v-session-secret-123';
    const expires = Date.now() + 60 * 1000; // 60s
    const hash = crypto.createHmac('sha256', secret)
        .update(`${studentId}-${lessonId}-${expires}`)
        .digest('hex');

    return Buffer.from(`${expires}.${hash}`).toString('base64');
}

/**
 * Encodes a string (e.g., a video ID part) using a simple reversible method.
 * Here we use Base64 as mentioned in the requirements. 
 * For XOR, we would need a key, which can be the session token.
 */
export function encodePart(text, key = '') {
    let out;
    if (!key) {
        out = Buffer.from(text);
    } else {
        // XOR with key if provided
        const input = Buffer.from(text);
        const keyBuf = Buffer.from(key);
        out = Buffer.alloc(input.length);
        for (let i = 0; i < input.length; i++) {
            out[i] = input[i] ^ keyBuf[i % keyBuf.length];
        }
    }

    // 🛡️ SECURITY HARDENING: Add random "junk" bytes at start and end
    // This breaks the standard Base64 structure and makes manual reconstruction much harder.
    const prefix = crypto.randomBytes(2);
    const suffix = crypto.randomBytes(2);
    const hardened = Buffer.concat([prefix, out, suffix]);
    
    return hardened.toString('base64');
}

/**
 * Splits a string into random sized parts (or fixed as per example).
 * Example: dQw4w9WgXcQ -> ["dQ","w4w","9Wg","XcQ"]
 */
export function splitVideoId(videoId) {
    if (!videoId) return [];

    // We can split into 4 parts roughly
    const len = videoId.length;
    const p1 = Math.floor(len / 4);
    const p2 = Math.floor(len / 2);
    const p3 = Math.floor((3 * len) / 4);

    return [
        videoId.substring(0, p1),
        videoId.substring(p1, p2),
        videoId.substring(p2, p3),
        videoId.substring(p3)
    ];
}

/**
 * Generates a protected video object for a single video ID.
 */
export function protectVideo(videoId, isReal, validationKey, sessionToken = '') {
    const parts = splitVideoId(videoId).map((v, i) => ({
        i: i + 1, // 1-based index as per example
        v: encodePart(v, sessionToken)
    }));

    // Shuffle parts
    for (let i = parts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [parts[i], parts[j]] = [parts[j], parts[i]];
    }

    return {
        isReal,
        validationKey: isReal ? validationKey : crypto.randomBytes(8).toString('hex'),
        parts
    };
}

/**
 * Wraps a video ID into a full protected response with fakes.
 */
export function wrapProtectedVideo(realVideoId, validationKey, sessionToken = '') {
    const fakesCount = 4;
    const realAt = Math.floor(Math.random() * (fakesCount + 1));

    const videos = [];
    for (let i = 0; i <= fakesCount; i++) {
        if (i === realAt) {
            videos.push(protectVideo(realVideoId, true, validationKey, sessionToken));
        } else {
            // Random fake video IDs (11 chars like YouTube)
            const fakeId = crypto.randomBytes(8).toString('base64').substring(0, 11);
            videos.push(protectVideo(fakeId, false, crypto.randomBytes(8).toString('hex'), sessionToken));
        }
    }

    return {
        fakeVideos: videos,
        videoSessionToken: sessionToken,
        validationKey // This should be known by the player to identify the real one, or it could be a hash of the student id/lesson id
    };
}

/**
 * Helper function to extract videoId from YouTube URL
 */
export function extractYouTubeVideoId(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) {
            return u.pathname.replace('/', '');
        }
        if (u.pathname.includes('/embed/')) {
            return u.pathname.split('/embed/')[1];
        }
        return u.searchParams.get('v');
    } catch {
        // Not a URL, maybe it's just the ID
        return url;
    }
}
