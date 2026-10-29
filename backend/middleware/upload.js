
const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new Error("Only JPEG, PNG, and WebP images are allowed.")
    );
  }

  callback(null, true);
};

const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fields: 10,
    parts: 15
  }
});

async function validateImageContents(req, res, next) {
  try {
    const files = req.files || [];

    for (const file of files) {
      const detectedType = await fileTypeFromBuffer(file.buffer);

      if (
        !detectedType ||
        !allowedMimeTypes.includes(detectedType.mime) ||
        detectedType.mime !== file.mimetype
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
