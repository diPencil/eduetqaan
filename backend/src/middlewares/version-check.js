import { ENV } from '../config/env.js';

/**
 * Middleware to enforce version control and playback protocol.
 * Requirements:
 * - Header: x-app-version (integer)
 * - Header: x-platform (android | ios | windows | macos | linux)
 * - Header: x-player-protocol (integer)
 */
export function checkAppVersion(req, res, next) {
    const versionHeader = req.headers['x-app-version'];
    const platform = (req.headers['x-platform'] || '').toLowerCase();
    const protocolHeader = req.headers['x-player-protocol'];

    const clientVersion = parseInt(versionHeader || '0', 10);
    const clientProtocol = parseInt(protocolHeader || '0', 10);

    // 1) Kill switch check (if enabled, we could reject all or use specific logic)
    if (ENV.KILL_SWITCH_ENABLED && clientVersion === 0) {
        return res.status(403).json({
            success: false,
            error: "PLAYER_DEPRECATED",
            message: "This player version is no longer supported. Please download the latest version from our website."
        });
    }

    // 2) Protocol Check (Critical for breaking old contracts)
    if (clientProtocol < ENV.REQUIRED_PLAYER_PROTOCOL) {
        return res.status(403).json({
            success: false,
            error: "APP_UPDATE_REQUIRED",
            message: "Your player protocol is outdated. Please update your app to the latest version.",
            requiredProtocol: ENV.REQUIRED_PLAYER_PROTOCOL
        });
    }

    // 3) Platform-specific Version Enforcement
    let minVersion = ENV.MIN_APP_VERSION_ANDROID; // Default
    if (platform === 'ios') {
        minVersion = ENV.MIN_APP_VERSION_IOS;
    } else if (['windows', 'macos', 'linux'].includes(platform)) {
        minVersion = ENV.MIN_APP_VERSION_DESKTOP;
    }

    if (clientVersion < minVersion) {
        return res.status(403).json({
            success: false,
            error: "APP_UPDATE_REQUIRED",
            message: "الإصدار الذي تستخدمه قديم جداً وغير مدعوم حالياً. يرجى تحديث المشغل إلى الإصدار الأحدث (V8/V9) لتتمكن من مشاهدة الفيديوهات.",
            platform,
            minVersion
        });
    }

    // 🛡️ SECURITY: Explicitly block anything not 8 or 9 if strictly requested
    // (Optional: can be adjusted if future versions like 10+ are released)
    if (![8, 9].includes(clientVersion)) {
        console.warn(`[VersionCheck] Unauthorized player version blocked: ${clientVersion}`);
        return res.status(403).json({
            success: false,
            error: "PLAYER_UNAUTHORIZED",
            message: "هذا المشغل غير مصرح له بالوصول للمحتوى. يرجى التأكد من استخدام المشغل الرسمي المحدث."
        });
    }

    // Store attributes for route logic
    req.appVersion = clientVersion;
    req.platform = platform;
    req.playerProtocol = clientProtocol;

    next();
}
