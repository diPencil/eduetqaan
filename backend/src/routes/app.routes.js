import { Router } from 'express';
import { ENV } from '../config/env.js';

export function createAppRouter() {
    const router = Router();

    /**
     * @swagger
     * /app/version:
     *   get:
     *     summary: Get minimum and current app version.
     */
    router.get('/version', (req, res) => {
        const platform = (req.headers['x-platform'] || '').toLowerCase();

        // Data for ALL platforms
        const config = {
            platforms: {
                android: ENV.MIN_APP_VERSION_ANDROID,
                ios: ENV.MIN_APP_VERSION_IOS,
                desktop: ENV.MIN_APP_VERSION_DESKTOP
            },
            protocolVersion: ENV.REQUIRED_PLAYER_PROTOCOL,
            killSwitch: ENV.KILL_SWITCH_ENABLED,
            timestamp: new Date().toISOString()
        };

        // If platform specified, give quick access keys
        if (platform === 'android') config.minVersion = ENV.MIN_APP_VERSION_ANDROID;
        else if (platform === 'ios') config.minVersion = ENV.MIN_APP_VERSION_IOS;
        else if (['windows', 'macos', 'linux'].includes(platform)) config.minVersion = ENV.MIN_APP_VERSION_DESKTOP;
        else config.minVersion = ENV.MIN_APP_VERSION_ANDROID; // Default

        res.json(config);
    });

    return router;
}
