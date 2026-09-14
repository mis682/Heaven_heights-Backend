const { parse } = require("csv-parse/sync");
const Guard = require("../models/Guard");

exports.list = async (req, res) => {
  const { siteName, module: mod } = req.query;
  const filter = {};
  if (siteName) filter.siteName = siteName;
  if (mod) filter.module = mod;
  const guards = await Guard.find(filter).sort({ name: 1 });
  res.json(guards);
};

exports.create = async (req, res) => {
  const guard = await Guard.create(req.body);
  res.status(201).json(guard);
};

exports.update = async (req, res) => {
  const guard = await Guard.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!guard) return res.status(404).json({ message: "Guard not found" });
  res.json(guard);
};

exports.remove = async (req, res) => {
  const guard = await Guard.findByIdAndDelete(req.params.id);
  if (!guard) return res.status(404).json({ message: "Guard not found" });
  res.json({ message: "Guard deleted" });
};

// Bulk re-import from an uploaded guard_master_seed.csv (EmployeeID,Name,SiteName,Module,FormActive)
exports.bulkImport = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file is required" });

  const content = req.file.buffer.toString("utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0;
  let updated = 0;

  for (const row of records) {
    const doc = {
      employeeId: row.EmployeeID,
      name: row.Name,
      siteName: row.SiteName,
      module: row.Module,
      formActive: String(row.FormActive).trim().toLowerCase() === "yes",
    };
    const result = await Guard.findOneAndUpdate(
      { employeeId: doc.employeeId },
      doc,
      { upsert: true, new: true, rawResult: true }
    );
    if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  res.json({ message: "Guard master data re-imported", created, updated, total: records.length });
};
