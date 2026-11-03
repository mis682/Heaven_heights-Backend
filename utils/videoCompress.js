const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const MAX_DURATION_SECONDS = 20;

// Scales down to max 720p height, re-encodes H.264/AAC at a modest bitrate,
// and hard-trims to MAX_DURATION_SECONDS as a server-side backstop (the
// public form already rejects longer videos before upload, but this covers
// anyone who bypasses that check). Uses temp files rather than piping
// buffers — fluent-ffmpeg's stream support is flaky for MP4's moov-atom
// requirements, temp files are the reliable option here.
function compressVideo(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tmpId = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `fmd-in-${tmpId}`);
    const outputPath = path.join(os.tmpdir(), `fmd-out-${tmpId}.mp4`);

    const cleanup = () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    };

    fs.writeFile(inputPath, inputBuffer, (writeErr) => {
      if (writeErr) return reject(writeErr);

      ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .audioBitrate("96k")
        .outputOptions([
          "-preset veryfast",
          "-crf 28",
          "-vf",
          "scale=-2:'min(720,ih)'",
          "-t",
          String(MAX_DURATION_SECONDS),
          "-movflags",
          "+faststart",
        ])
        .on("error", (err) => {
          cleanup();
          reject(err);
        })
        .on("end", () => {
          fs.readFile(outputPath, (readErr, compressedBuffer) => {
            cleanup();
            if (readErr) return reject(readErr);
            resolve(compressedBuffer);
          });
        })
        .save(outputPath);
    });
  });
}

module.exports = { compressVideo, MAX_DURATION_SECONDS };
