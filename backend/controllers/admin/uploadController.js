const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendError } = require('../../utils/response');

const uploadsDir = path.join(__dirname, '../../public/uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) are allowed!'));
  }
}).single('file');

async function uploadImage(req, res) {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return sendError(res, 400, 'Multer error: ' + err.message);
    }
    if (err) {
      return sendError(res, 400, err.message);
    }
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });
}

module.exports = { uploadImage };
