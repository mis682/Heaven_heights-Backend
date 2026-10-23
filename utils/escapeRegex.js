// Escapes regex metacharacters so user-supplied search text can be used
// safely as a MongoDB $regex filter instead of exact-matching the whole field.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
