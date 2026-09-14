const mongoose = require("mongoose");

// Tracks the last calendar day a backup was actually sent, so a Render
// restart/redeploy (which re-runs runDailyBackup() as a startup safety net)
// doesn't re-send the same day's backup email every time the process
// restarts — only once per IST calendar day gets through.
const BackupStateSchema = new mongoose.Schema({
  lastBackupDate: { type: String, default: "" },
});

module.exports = mongoose.model("BackupState", BackupStateSchema);
