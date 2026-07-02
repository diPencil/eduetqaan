// src/services/replicator.js
import { v4 as uuidv4 } from 'uuid';
import { isMysqlUp } from '../config/db.js';

export async function performOperation(opts) {
  const {
    modelName,
    sqliteModel,
    mysqlModel,
    op,
    data = {},
    where = {},
    outboxModel,
    syncLogModel, // New
  } = opts;

  const operationId = uuidv4();
  const startTime = Date.now();

  const createLog = async (status, details) => {
    if (syncLogModel) {
      try {
        await syncLogModel.create({
          operationId,
          modelName,
          op,
          status,
          details: typeof details === 'string' ? details : JSON.stringify(details),
          durationMs: Date.now() - startTime,
        });
      } catch (logErr) {
        console.error('[replicator] Failed to create log:', logErr.message);
      }
    }
  };

  const hasSqlite = !!sqliteModel;
  const hasMysql = !!mysqlModel;

  if (!hasSqlite && !hasMysql) {
    throw new Error(`performOperation(): no models provided for ${modelName}`);
  }

  const primaryModel = hasSqlite ? sqliteModel : mysqlModel;
  const replicaModel = hasSqlite && hasMysql ? mysqlModel : null;

  let primaryResult;

  try {
    // 1) Execute on Primary (SQLite)
    if (op === 'create') {
      primaryResult = await primaryModel.create({ ...data });
    } else if (op === 'update') {
      const updateData = { ...data };
      if (!Object.prototype.hasOwnProperty.call(updateData, 'updatedAtLocal')) {
        updateData.updatedAtLocal = new Date();
      }
      await primaryModel.update(updateData, { where });
      primaryResult = await primaryModel.findOne({ where });
    } else if (op === 'delete') {
      primaryResult = await primaryModel.findOne({ where });
      await primaryModel.destroy({ where });
    }
  } catch (err) {
    await createLog('FAILED', `Primary error: ${err.message}`);
    throw err;
  }

  // 2) If no replica, return
  if (!replicaModel) {
    await createLog('SUCCESS', 'Operation completed on single DB');
    return primaryResult;
  }

  // 3) Try to write to MySQL Replica
  try {
    if (hasMysql && (await isMysqlUp())) {
      if (op === 'create') {
        await replicaModel.create({ ...data });
      } else if (op === 'update') {
        await replicaModel.update({ ...data }, { where });
      } else if (op === 'delete') {
        await replicaModel.destroy({ where });
      }
      await createLog('SUCCESS', 'Synced to MySQL immediately');
      return primaryResult;
    }
  } catch (e) {
    console.warn(`[replicator] MySQL failed. Enqueue to outbox.`, e.message);
  }

  // 4) MySQL down -> Outbox
  if (outboxModel) {
    try {
      await outboxModel.create({
        operationId,
        modelName,
        op,
        payload: { data, where },
      });
      await createLog('WARNING', 'MySQL Offline: Enqueued to outbox');
    } catch (err) {
      await createLog('FAILED', `Failed to enqueue: ${err.message}`);
    }
  }

  return primaryResult;
}

export default performOperation;
