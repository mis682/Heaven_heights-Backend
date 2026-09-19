const mongoose = require("mongoose");

// Cached on `global` (not a module-level variable) because Vercel's
// serverless runtime can reuse the same execution context across
// invocations but re-`require()` this module fresh each time — caching
// on `global` is what actually survives between warm invocations and
// avoids opening a new MongoDB connection per request.
const cached = (global.__mongoose ||= { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/heavenheights";
    // Mongoose defaults to a pool of up to 100 connections per instance —
    // fine for one long-running server, but Vercel can spin up many
    // concurrent serverless instances (regular traffic + the archival
    // cron overlapping), each caching its own connection with its own
    // pool. Several instances at 100 each is exactly how Atlas's M0
    // 500-connection ceiling got hit. Capping this small per instance
    // keeps the combined total across every concurrent instance well
    // under that limit even during a burst.
    cached.promise = mongoose.connect(uri, { maxPoolSize: 5 }).then((m) => {
      console.log(`[db] connected -> ${uri}`);
      return m;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
