import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';

// Конфигурация для аватаров пользователей
const avatarUploadDir = path.join(__dirname, '../../uploads/avatars');
const questionUploadDir = path.join(__dirname, '../../uploads/questions');

// Генератор уникальных имен файлов
const generateFilename = (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
};

// Общий фильтр для изображений
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только JPG, PNG, WEBP и GIF'));
  }
};

// Хранилище для аватаров
const avatarStorage = multer.diskStorage({
  destination: avatarUploadDir,
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  }
});

// Хранилище для изображений вопросов
const questionStorage = multer.diskStorage({
  destination: questionUploadDir,
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  }
});

// Экспортируемые конфигурации
export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { 
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

export const uploadQuestionImage = multer({
  storage: questionStorage,
  fileFilter: imageFileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB (для вопросов можно больше)
    files: 1 // Только один файл за раз
  }
});

// Валидатор для проверки загруженных файлов
export const validateImageFile = (file?: Express.Multer.File) => {
  if (!file) {
    throw new Error('Файл не был загружен');
  }
  
  const ext = path.extname(file.originalname).toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  if (!validExtensions.includes(ext)) {
    throw new Error('Недопустимое расширение файла');
  }
};