// Shared KPI computation for every checklist-style Daily Report module
// (Garden City Housekeeping, GC Club, Reserve Club, Regal Garden Club, One
// Business Center, Nature Park, Maintenance Uniform). Reused instead of
// re-implementing the same aggregation 7 times — only the grouping
// dimension (checkpoint vs staff) and status vocabulary differ per module.
//
// Only `goodStatus` counts as compliant. Every other value — including
// "NA"/"Holiday"/"Guest"/"Week off"/"Leave"/"Absent" and an unfilled
// ("") status — counts against the group, matching the coordinator's own
// rule: every day needs a real OK/Present/Clean entry, anything else is a
// remark that needs following up on, not a free pass.
async function computeChecklistKpi(Model, { from, to, extraFilter = {}, goodStatus, groupKey, groupLabel }) {
  const filter = { status: "submitted", reportDate: { $gte: from, $lte: to }, ...extraFilter };
  const reports = await Model.find(filter).select("entries reportDate").lean();

  const byGroup = new Map();
  for (const report of reports) {
    for (const entry of report.entries || []) {
      const key = groupKey(entry);
      if (key === null || key === undefined || key === "") continue;
      if (!byGroup.has(key)) {
        byGroup.set(key, { key, label: groupLabel(entry), ok: 0, notOk: 0, total: 0, breakdown: {}, notOkDetails: [] });
      }
      const g = byGroup.get(key);
      g.total += 1;
      const status = entry.status || "";
      if (status === goodStatus) {
        g.ok += 1;
      } else {
        g.notOk += 1;
        const label = status || "Not filled";
        g.breakdown[label] = (g.breakdown[label] || 0) + 1;
        g.notOkDetails.push({ date: report.reportDate, status: label });
      }
    }
  }

  return [...byGroup.values()]
    .map((g) => ({ ...g, okPercent: g.total > 0 ? Math.round((g.ok / g.total) * 100) : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = { computeChecklistKpi };
