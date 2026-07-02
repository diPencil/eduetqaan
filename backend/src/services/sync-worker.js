/**
 * Worker دوري يسحب عمليات outbox ويطبقها على MySQL
 * ملاحظات:
 *  - idempotency مبسطة: لو حصل Duplicate Key في create نعتبرها success.
 *  - Last write wins في update/delete.
 */
export function startPeriodicSync(modelsMap, intervalMs = 5000) {
  const timer = setInterval(() => syncOnce(modelsMap).catch(e => {
    console.error('[sync] error:', e);
  }), intervalMs);

  // console.log(`🔁 Sync worker started (every ${intervalMs} ms)`);
  return () => clearInterval(timer);
}

export async function syncOnce(modelsMap) {
  const { Outbox, isMysqlUp } = modelsMap.__helpers;
  if (!await isMysqlUp()) return false;

  // نسحب العمليات المعلقة فقط، ونتخطى ما فشل تماماً (إلا لو المستخدم طلب يدوي لاحقاً)
  if (!Outbox) {
    console.warn('[sync] Outbox model is undefined. Skipping sync cycle.');
    return false;
  }

  const batch = await Outbox.findAll({ 
    where: { status: 'PENDING' },
    order: [['id', 'ASC']], 
    limit: 100 
  });

  if (batch.length === 0) return true;

  for (const row of batch) {
    const { modelName, op, payload, operationId } = row;
    const pair = modelsMap[modelName];
    
    row.lastAttemptAt = new Date();
    row.attempts = (row.attempts || 0) + 1;

    if (!pair) {
      row.status = 'FAILED';
      row.lastError = `No model mapping found for ${modelName}`;
      await row.save();
      continue;
    }

    const mysqlModel = pair.mysqlModel;

    try {
      if (op === 'create') {
        await mysqlModel.create(payload.data)
          .catch(err => {
            if (/duplicate/i.test(err?.message)) return;
            throw err;
          });
      } else if (op === 'bulkCreate') {
        await mysqlModel.bulkCreate(payload.data)
          .catch(err => {
            if (/duplicate/i.test(err?.message)) return;
            throw err;
          });
      } else if (op === 'update') {
        await mysqlModel.update(payload.data, { where: payload.where });
      } else if (op === 'delete') {
        await mysqlModel.destroy({ where: payload.where });
      }

      await row.destroy(); // نجحت المزامنة → حذف من الـ outbox
    } catch (e) {
      row.lastError = e.message;
      
      // لو فشل أكثر من 10 مرات، نحوله لـ FAILED للتدخل اليدوي
      if (row.attempts >= 10) {
        row.status = 'FAILED';
      }
      
      await row.save();
      console.warn(`[sync] failed op ${operationId}: ${e.message} (attempt ${row.attempts})`);
    }
  }
  return true;
}
