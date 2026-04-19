const multer = require('multer');
const path = require('path');
const fs = require('fs');

const staffPhotosDir = path.join(__dirname, 'uploads', 'staff');
if (!fs.existsSync(staffPhotosDir)) {
  fs.mkdirSync(staffPhotosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, staffPhotosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, base + '-' + unique + ext);
  }
});

const staffPhotoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

module.exports = { staffPhotoUpload, staffPhotosDir };
