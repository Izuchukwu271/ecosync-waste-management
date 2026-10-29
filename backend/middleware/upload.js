
const multer = require("multer");

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fields: 10,
    parts: 15
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG, and WebP images are allowed.")
      );
    }

    callback(null, true);
  }
});

async function validateImageContents(req, res, next) {
  try {
    const files = req.files || [];

    // Dynamic import supports file-type's ES module format.
    const { fileTypeFromBuffer } = await import("file-type");

    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);

      if (
        !detected ||
        !allowedMimeTypes.includes(detected.mime) ||
        detected.mime !== file.mimetype
      ) {
        return res.status(400).json({
          error: "An uploaded file is not a valid supported image."
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadPhotos,
  validateImageContents
};
