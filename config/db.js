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
    cached.promise = mongoose.connect(uri).then((m) => {
      console.log(`[db] connected -> ${uri}`);
      return m;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
