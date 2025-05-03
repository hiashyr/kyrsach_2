import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { plainToClass } from "class-transformer";
import { IsEmail, IsString, MinLength, validate } from 'class-validator';
import { sendVerificationEmail } from '../services/emailService';
import crypto from 'crypto';
import { EmailVerificationToken } from '../entities/EmailVerificationToken';
import logger from '../config/logger';
import multer from 'multer';
import path from 'path';

// Инициализация репозитория
const userRepository = AppDataSource.getRepository(User);

class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
  password!: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  password!: string;
}

const tokenRepository = AppDataSource.getRepository(EmailVerificationToken);

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const registerDto = plainToClass(RegisterDto, req.body);
    const errors = await validate(registerDto);

    if (errors.length > 0) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Ошибка валидации",
        details: errors.map(err => ({
          field: err.property,
          constraints: err.constraints
        }))
      });
      return;
    }

    const { email, password } = registerDto;

    const existingUser = await userRepository.findOne({ 
      where: { email },
      relations: ['emailVerificationTokens']
    });

    if (existingUser) {
      // Если пользователь не подтвердил email, разрешаем повторную регистрацию
      if (!existingUser.isVerified) {
        await tokenRepository.delete({ 
          user: { id: existingUser.id } 
        });
        await userRepository.delete(existingUser.id);
      } else {
        res.status(400).json({ 
          error: "EMAIL_EXISTS",
          message: "Email уже используется",
          field: "email"
        });
        return;
      }
    }

    const user = new User();
    user.email = email;
    user.password_hash = password;
    user.isVerified = false;

    // Логируем перед сохранением
    logger.info('Creating new user', { email, createdAt: user.createdAt });

    await userRepository.save(user);

    // Логируем после сохранения
    logger.info('User created successfully', { 
      userId: user.id,
      createdAt: user.createdAt 
    });

    const token = crypto.randomBytes(32).toString('hex');
    const verificationToken = new EmailVerificationToken();
    verificationToken.token = token;
    verificationToken.user = user;
    verificationToken.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await tokenRepository.save(verificationToken);
    
    logger.info('Verification token created', {
      userId: user.id,
      token,
      expiresAt: verificationToken.expiresAt
    });

    await sendVerificationEmail(user.email, token);

    res.status(201).json({ 
      success: true,
      message: "Регистрация успешна. Проверьте email для подтверждения.",
      email: user.email
    });

  } catch (error) {
    logger.error("Registration error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка при регистрации" 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Находим пользователя с email verification tokens
    const user = await userRepository.findOne({ 
      where: { email },
      relations: ['emailVerificationTokens'],
      select: ['id', 'email', 'password_hash', 'isVerified', 'role']
    });

    if (!user) {
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Неверный email или пароль",
        field: "email"
      });
      return;
    }

    // 2. Проверка подтверждения email
    if (!user.isVerified) {
      const hasActiveToken = user.emailVerificationTokens?.some(
        t => t.expiresAt > new Date()
      );
      
      res.status(403).json({
        error: "EMAIL_NOT_VERIFIED",
        message: hasActiveToken 
          ? "Подтвердите email, письмо отправлено"
          : "Ссылка истекла. Запросите новое письмо",
        canResend: true
      });
      return;
    }

    // 3. Сравнение пароля
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Неверный email или пароль",
        field: "password"
      });
      return;
    }

    // 4. Генерация JWT токена
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "Ошибка при авторизации"
    });
  }
};

export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await userRepository.findOne({ 
      where: { email },
      relations: ['emailVerificationTokens']
    });

    if (!user) {
      res.status(404).json({ 
        error: "USER_NOT_FOUND",
        message: "Пользователь не найден"
      });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ 
        error: "EMAIL_ALREADY_VERIFIED",
        message: "Email уже подтверждён"
      });
      return;
    }

    // Удаляем все старые токены
    await tokenRepository.delete({ user: { id: user.id } });

    // Создаём новый токен
    const token = crypto.randomBytes(32).toString('hex');
    const verificationToken = new EmailVerificationToken();
    verificationToken.token = token;
    verificationToken.user = user;
    verificationToken.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await tokenRepository.save(verificationToken);
    logger.info('New verification token created', {
      userId: user.id,
      token,
      expiresAt: verificationToken.expiresAt
    });

    await sendVerificationEmail(user.email, token);

    res.json({ 
      success: true, 
      message: "Письмо отправлено повторно",
      expiresAt: verificationToken.expiresAt
    });
  } catch (error) {
    logger.error("Resend verification error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка при отправке письма" 
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    const user = await userRepository.findOne({
      where: { id: req.user.id },
      select: ['id', 'email', 'role', 'avatar_url', 'createdAt']
    });

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    // Добавляем полный URL к аватару
    const userResponse = {
      ...user,
      avatarUrl: user.avatar_url 
        ? `${process.env.FRONTEND_URL || process.env.API_URL || ''}${user.avatar_url}`
        : null
    };

    res.json(userResponse);
  } catch (error) {
    logger.error("Get user error:", error);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ 
        error: "FORBIDDEN",
        message: "Доступ запрещен" 
      });
      return;
    }

    const users = await userRepository.find({
      select: ['id', 'email', 'role', 'createdAt']
    });
    
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка сервера" 
    });
  }
};

export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }

    const usersCount = await userRepository.count();
    const questionsCount = 0; // Замените на реальный запрос
    
    res.json({
      usersCount,
      questionsCount,
      testsCompleted: 0
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};


function generateToken(user: User): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET не установлен");
  }

  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      isVerified: user.isVerified
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

// Конфигурация Multer для загрузки файлов
const avatarStorage = multer.diskStorage({
  destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

export const avatarUpload = multer({ 
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  }
});

export const uploadAvatar = async (req: Request & { user?: User }, res: Response) => {
  try {
    // 1. Проверка аутентификации
    if (!req.user) {
      return res.status(401).json({ error: 'Необходима авторизация' });
    }

    // 2. Проверка загруженного файла
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    // 3. Обновление аватара в БД
    const userRepository = AppDataSource.getRepository(User);
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    await userRepository.update(req.user.id, { avatar_url: avatarUrl });

    // 4. Возвращаем новый URL аватара
    res.json({ 
      success: true,
      avatarUrl 
    });

  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера при загрузке аватара',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    });
  }
};

export const changePassword = async (
  req: Request & { user?: User },
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Проверка аутентификации
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        error: "Not authenticated" 
      });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    // 2. Поиск пользователя
    const user = await userRepository.findOne({ 
      where: { id: req.user.id },
      select: ['id', 'password_hash']
    });

    if (!user) {
      res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
      return;
    }

    // 3. Проверка текущего пароля
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ 
        success: false,
        error: "Current password is incorrect" 
      });
      return;
    }

    // 4. Обновление пароля
    user.password_hash = newPassword;
    await userRepository.save(user);

    // 5. Успешный ответ
    res.json({ 
      success: true,
      message: "Password updated successfully" 
    });

  } catch (error) {
    // 6. Обработка ошибок
    logger.error('Password change error:', error);
    res.status(500).json({ 
      success: false,
      error: "Failed to change password",
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    });
  }
};
