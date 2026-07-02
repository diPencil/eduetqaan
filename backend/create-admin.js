import { getMysql, getSqlite, initDatabases } from "./src/config/db.js";
import { registerModels } from "./src/models/index.js";
import bcrypt from "bcryptjs";

async function run() {
  await initDatabases();
  const models = registerModels();
  
  const email = "admin@etqan.com";
  const password = "password123";
  const passwordHash = bcrypt.hashSync(password, 10);
  
  try {
    const user = await models.User.create({
      email,
      passwordHash,
      role: 'admin',
      name: 'Super Admin',
      isActive: true,
      updatedAtLocal: new Date(),
    });
    console.log("Admin user created successfully:", user.email, "Password:", password);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.log("Admin user already exists with this email.");
    } else {
      console.error("Error creating admin user:", err);
    }
  }
  process.exit(0);
}

run();
