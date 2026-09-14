require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const connectDB = require("../config/db");
const Project = require("../models/Project");
const Checkpoint = require("../models/Checkpoint");
const Guard = require("../models/Guard");
const Employee = require("../models/Employee");
const MaintenanceStaff = require("../models/MaintenanceStaff");

const PATROL_PROJECTS = [
  { name: "Garden City", slug: "garden-city", checkpointCount: 14 },
  { name: "Regal Garden", slug: "regal-garden", checkpointCount: 10 },
  { name: "Nature Park", slug: "nature-park", checkpointCount: 9 },
  { name: "School", slug: "school", checkpointCount: 6 },
  { name: "Wildflower", slug: "wildflower", checkpointCount: 5 },
];

const NIGHT_GUARD_PROJECTS = [
  { name: "One Business Center", slug: "one-business-center" },
  { name: "Hyde Park", slug: "hyde-park" },
  { name: "Milestone", slug: "milestone" },
  { name: "GST", slug: "gst" },
];

const PENDING_PROJECTS = [
  { name: "Mahalgaon New Site", slug: "mahalgaon-new-site" },
  { name: "Badagaon New Site", slug: "badagaon-new-site" },
  { name: "Girwai", slug: "girwai" },
  { name: "Marigold", slug: "marigold" },
];

const DEMO_EMPLOYEES = [
  { name: "Anita Sharma", employeeId: "HK001", department: "Housekeeping", role: "Housekeeping Staff", shiftStart: "08:00" },
  { name: "Rahul Verma", employeeId: "HK002", department: "Housekeeping", role: "Housekeeping Staff", shiftStart: "08:00" },
  { name: "Priya Nair", employeeId: "HK003", department: "Housekeeping", role: "Housekeeping Supervisor", shiftStart: "08:00" },
  { name: "Suresh Patil", employeeId: "AD001", department: "Admin", role: "Coordinator", shiftStart: "09:00" },
];

async function seedProjectsAndCheckpoints() {
  for (const p of PATROL_PROJECTS) {
    const project = await Project.findOneAndUpdate(
      { slug: p.slug },
      { ...p, module: "patrol_checkpoint", formActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const existingCount = await Checkpoint.countDocuments({ projectId: project._id });
    if (existingCount !== p.checkpointCount) {
      await Checkpoint.deleteMany({ projectId: project._id });
      const checkpoints = Array.from({ length: p.checkpointCount }, (_, i) => ({
        projectId: project._id,
        checkpointId: i + 1,
        name: `Checkpoint ${i + 1}`,
        order: i + 1,
      }));
      await Checkpoint.insertMany(checkpoints);
    }
  }

  for (const p of NIGHT_GUARD_PROJECTS) {
    await Project.findOneAndUpdate(
      { slug: p.slug },
      { ...p, module: "night_guard", checkpointCount: 0, formActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const p of PENDING_PROJECTS) {
    await Project.findOneAndUpdate(
      { slug: p.slug },
      { ...p, module: "pending", checkpointCount: 0, formActive: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("[seed] projects + checkpoints ready");
}

async function seedGuards() {
  const csvPath = path.join(__dirname, "..", "guard_master_seed.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn(`[seed] guard_master_seed.csv not found at ${csvPath}, skipping guard seed`);
    return;
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  for (const row of records) {
    await Guard.findOneAndUpdate(
      { employeeId: row.EmployeeID },
      {
        employeeId: row.EmployeeID,
        name: row.Name,
        siteName: row.SiteName,
        module: row.Module,
        formActive: String(row.FormActive).trim().toLowerCase() === "yes",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`[seed] guards ready (${records.length} rows)`);
}

async function seedMaintenanceStaff() {
  const csvPath = path.join(__dirname, "..", "maintenance_staff_seed.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn(`[seed] maintenance_staff_seed.csv not found at ${csvPath}, skipping`);
    return;
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  for (const row of records) {
    await MaintenanceStaff.findOneAndUpdate(
      { employeeId: row.EmployeeID },
      {
        employeeId: row.EmployeeID,
        siteName: row.SiteName,
        designation: row.Designation,
        name: row.Name,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`[seed] maintenance staff ready (${records.length} rows)`);
}

async function seedEmployees() {
  for (const e of DEMO_EMPLOYEES) {
    await Employee.findOneAndUpdate(
      { employeeId: e.employeeId },
      e,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log("[seed] demo employees ready");
}

async function run() {
  await connectDB();
  await seedProjectsAndCheckpoints();
  await seedGuards();
  await seedMaintenanceStaff();
  await seedEmployees();
  console.log("[seed] done");
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
