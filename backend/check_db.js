
import { getMysql } from './src/config/db.js';
import { registerModels } from './src/models/index.js';
import { initDatabases } from './src/config/db.js';

async function check() {
  await initDatabases();
  const models = registerModels();
  const [pCols] = await getMysql().query("DESCRIBE payments");
  console.log("PAYMENTS COLUMNS:", pCols);

  const [oCols] = await getMysql().query("DESCRIBE orders");
  console.log("ORDERS COLUMNS:", oCols);
  process.exit(0);
}

check();
