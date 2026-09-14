require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const Role = require("../models/Role");
const { PERMISSION_MODULES, emptyPermissions } = require("../constants/permissionModules");

const ALL_TRUE = { view: true, edit: true, delete: true };

// These exact defaults reproduce the app's original hardcoded role-array nav
// behavior precisely, so nothing changes for existing users the moment
// permission-driven nav ships. Admin can freely edit/rename/delete the
// non-system ones afterwards from the Roles tab.
const BUILT_IN_ROLES = [
  {
    name: "Admin",
    isSystem: true,
    permissions: Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, { ...ALL_TRUE }])),
  },
  {
    name: "Security Manager",
    isSystem: false,
    permissions: {
      ...emptyPermissions(),
      attendance: { view: true, edit: false, delete: false },
      patrol: { view: true, edit: true, delete: false },
      nightGuard: { view: true, edit: true, delete: false },
      fireMockDrill: { view: true, edit: true, delete: false },
      guards: { view: true, edit: false, delete: false },
      gcHousekeeping: { view: true, edit: false, delete: false },
      gcClub: { view: true, edit: false, delete: false },
      reserveClub: { view: true, edit: false, delete: false },
      regalGardenClub: { view: true, edit: false, delete: false },
    },
  },
  {
    name: "Coordinator",
    isSystem: false,
    permissions: {
      ...emptyPermissions(),
      gcHousekeeping: { view: true, edit: true, delete: false },
      gcClub: { view: true, edit: true, delete: false },
      reserveClub: { view: true, edit: true, delete: false },
      regalGardenClub: { view: true, edit: true, delete: false },
      patrol: { view: true, edit: true, delete: false },
      nightGuard: { view: true, edit: true, delete: false },
      attendance: { view: true, edit: false, delete: false },
    },
  },
  { name: "Staff", isSystem: false, permissions: emptyPermissions() },
];

async function ensureBuiltInRoles() {
  for (const r of BUILT_IN_ROLES) {
    await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  console.log(`[seed:admin] built-in roles ready (${BUILT_IN_ROLES.map((r) => r.name).join(", ")})`);
}

async function ensureInitialAdminUser() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const name = process.env.INITIAL_ADMIN_NAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !name || !password) {
    console.error("[seed:admin] Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME and INITIAL_ADMIN_PASSWORD in .env first");
    return;
  }

  const existingAdmin = await User.findOne({ role: "Admin" });
  if (existingAdmin) {
    console.log(`[seed:admin] An Admin account already exists (${existingAdmin.email}) — skipping`);
    return;
  }

  const adminRole = await Role.findOne({ name: "Admin" });
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await User.create({
    name,
    email: email.trim().toLowerCase(),
    passwordHash,
    role: "Admin",
    permissions: adminRole.permissions,
    active: true,
  });

  console.log(`[seed:admin] Created initial Admin user: ${admin.email}`);
}

async function run() {
  await connectDB();
  await ensureBuiltInRoles();
  await ensureInitialAdminUser();
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed:admin] failed", err);
  process.exit(1);
});
