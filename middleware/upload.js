const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const CloudinaryAlertState = require("../models/CloudinaryAlertState");

const primaryCloudinaryAuth = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

cloudinary.config(primaryCloudinaryAuth);

// Housekeeping photos go to a separate Cloudinary account (its own free-tier
// quota) so this module's volume doesn't eat into the credits the other
// modules share. Credentials are passed per-call instead of via
// cloudinary.config() — the SDK accepts cloud_name/api_key/api_secret
// directly in each call's options, taking precedence over the global config
// for just that call, so this never touches the primary account's config.
const housekeepingCloudinaryAuth = {
  cloud_name: process.env.CLOUDINARY_HOUSEKEEPING_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_HOUSEKEEPING_API_KEY,
  api_secret: process.env.CLOUDINARY_HOUSEKEEPING_API_SECRET,
};

// Further optional fallback tiers beyond Housekeeping, numbered 3.. — set
// CLOUDINARY_FALLBACK<N>_CLOUD_NAME/API_KEY/API_SECRET on Render to add one.
// A tier left unconfigured (or any gap in the numbering) is simply skipped,
// so adding another account later — 5th, 6th, however many — never needs a
// code change, only new env vars.
const MAX_FALLBACK_TIERS = 20;
const numberedFallbackAuths = Array.from({ length: MAX_FALLBACK_TIERS - 2 }, (_, i) => {
  const n = i + 3;
  return {
    label: `Fallback ${n}`,
    cloud_name: process.env[`CLOUDINARY_FALLBACK${n}_CLOUD_NAME`],
    api_key: process.env[`CLOUDINARY_FALLBACK${n}_API_KEY`],
    api_secret: process.env[`CLOUDINARY_FALLBACK${n}_API_SECRET`],
  };
});

// Ordered failover chain for "main" uploads (Attendance, Patrol, Night
// Guard, Fire Mock Drill, Maintenance Staff): once the currently-active
// account's usage crosses cloudinaryUsageAlert's failover threshold, new
// uploads move to the next tier here instead of risking outright upload
// failures once an account's free-plan credits run out. Falls back to
// Primary as soon as Primary's own usage recovers (e.g. the monthly reset),
// regardless of which tier is currently active.
const CLOUDINARY_ACCOUNTS = [
  { label: "Primary", ...primaryCloudinaryAuth },
  { label: "Housekeeping", ...housekeepingCloudinaryAuth },
  ...numberedFallbackAuths,
].filter((a) => a.cloud_name && a.api_key && a.api_secret);

// Reads the tier set by that periodic check rather than calling Cloudinary's
// usage API on every single upload.
async function getMainUploadAuth() {
  const state = await CloudinaryAlertState.findOne();
  const { label, ...auth } = CLOUDINARY_ACCOUNTS[state?.activeAccountIndex || 0] || CLOUDINARY_ACCOUNTS[0];
  return auth;
}

class CloudinaryStorage {
  async _handleFile(req, file, cb) {
    let auth;
    try {
      auth = await getMainUploadAuth();
    } catch (err) {
      return cb(err);
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...auth,
        folder: "heaven-heights",
        resource_type: "image",
        transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, () => cb());
  }
}

const upload = multer({
  storage: new CloudinaryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Resource type is picked per field name — images stay optimized, videos and
// documents (fieldname-driven) go up untouched via Cloudinary's video/raw
// endpoints instead of the image endpoint, which would reject them.
const FIELD_RESOURCE_TYPES = {
  panelPhoto: "image",
  videos: "video",
  reportAttachment: "raw",
  checklistAttachments: "raw",
};

class MixedCloudinaryStorage {
  async _handleFile(req, file, cb) {
    let auth;
    try {
      auth = await getMainUploadAuth();
    } catch (err) {
      return cb(err);
    }
    const resourceType = FIELD_RESOURCE_TYPES[file.fieldname] || "auto";
    const options = { ...auth, folder: "heaven-heights", resource_type: resourceType };
    if (resourceType === "image") {
      options.transformation = [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good", fetch_format: "auto" }];
    }
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return cb(error);
      cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes, resourceType });
    });
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    const resourceType = FIELD_RESOURCE_TYPES[file.fieldname] || "image";
    cloudinary.uploader.destroy(file.filename, { resource_type: resourceType }, () => cb());
  }
}

// Separate instance with a much larger size limit for video/document uploads.
const uploadMixed = multer({
  storage: new MixedCloudinaryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

class HousekeepingCloudinaryStorage {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...housekeepingCloudinaryAuth,
        folder: "heaven-heights-housekeeping",
        resource_type: "image",
        transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, housekeepingCloudinaryAuth, () => cb());
  }
}

const uploadHousekeeping = multer({
  storage: new HousekeepingCloudinaryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// file.path is the Cloudinary secure_url set by CloudinaryStorage above
function fileToUrl(file) {
  return file.path;
}

module.exports = {
  upload,
  uploadMixed,
  uploadHousekeeping,
  cloudinary,
  fileToUrl,
  primaryCloudinaryAuth,
  housekeepingCloudinaryAuth,
  CLOUDINARY_ACCOUNTS,
};
