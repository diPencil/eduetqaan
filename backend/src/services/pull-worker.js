import { isMysqlUp, getSqlite, getMysql } from '../config/db.js';

/**
 * Pull Worker: جلب التحديثات من MySQL وتطبيقها على SQLite محلياً.
 */
export function startPeriodicPull(modelsMap, intervalMs = 60000) {
  const timer = setInterval(() => pullOnce(modelsMap).catch(e => {
    console.error('[pull] Global error:', e);
  }), intervalMs);

  // console.log(`🔁 Pull worker active for all models (every ${intervalMs} ms)`);
  return () => clearInterval(timer);
}

export async function pullOnce(modelsMap) {
  if (!await isMysqlUp()) return false;

  const { SyncLog } = modelsMap.__helpers;
  const startTime = Date.now();

  // اكتشاف كل الموديلات المتاحة تلقائياً (استثناء الهيلبرز)
  const syncableModels = Object.keys(modelsMap).filter(k => k !== '__helpers' && k !== 'Outbox' && k !== 'SyncLog');

  const sqlite = getSqlite();
  const mysql = getMysql();
  
  try {
    // Disable FK checks during pull to avoid constraint errors on out-of-order records
    await sqlite.query('PRAGMA foreign_keys = OFF');

    let totalUpserted = 0;
    const upsertDetails = [];

    for (const name of syncableModels) {
      const { sqliteModel, mysqlModel } = modelsMap[name];
      if (!sqliteModel || !mysqlModel) continue;

      try {
        // 1. Detect which timestamp column to use (updatedAt or updatedAtLocal)
        const dateCol = (sqliteModel.rawAttributes && sqliteModel.rawAttributes.updatedAtLocal) ? 'updatedAtLocal' : 'updatedAt';

        // 2. Get latest local modification
        const latestLocal = await sqliteModel.findOne({
          order: [[dateCol, 'DESC']],
          attributes: [dateCol]
        });
        
        const lastUpdate = latestLocal ? latestLocal[dateCol] : new Date(0);

        // 3. Pull updates from MySQL
        const remoteUpdates = await mysqlModel.findAll({
          where: {
            [dateCol]: { [Symbol.for('gt')]: lastUpdate }
          },
          limit: 100
        });
        
        if (remoteUpdates.length > 0) {
          let successCount = 0;
          for (const remoteRow of remoteUpdates) {
            const data = remoteRow.toJSON();
            if (!data.id) continue;
            
            await sqliteModel.upsert(data);
            successCount++;
            totalUpserted++;
          }
          upsertDetails.push(`${name}(${successCount})`);

          // تسجيل العملية في السجل
          if (SyncLog) {
            await SyncLog.create({
              modelName: name,
              op: 'pull',
              status: 'SUCCESS',
              details: `Pulled ${successCount} updates from MySQL`,
              durationMs: Date.now() - startTime
            });
          }
        }
        
        // ⚡ NEW: Small delay after each model to prevent DB starvation
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        // Silently skip sync errors for missing fields or tables during regular pull
        
        if (SyncLog) {
          await SyncLog.create({
            modelName: name,
            op: 'pull',
            status: 'FAILED',
            details: err.message,
            durationMs: Date.now() - startTime
          });
        }
      }
    }

    if (totalUpserted > 0) {
      // console.log(`[pull] Delta sync completed. Upserted ${totalUpserted} rows: ${upsertDetails.join(', ')}`);
    }

  } finally {
    await sqlite.query('PRAGMA foreign_keys = ON');
  }

  return true;
}
