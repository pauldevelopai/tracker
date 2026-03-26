import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

const UPLOAD_ROOT = path.resolve(process.cwd(), '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = req.body.entity_type || 'general';
    const now = new Date();
    const dir = path.join(UPLOAD_ROOT, entityType, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported. Accepted: PDF, DOCX, XLSX, CSV, TXT`));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
