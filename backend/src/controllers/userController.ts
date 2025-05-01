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

const userRepository = AppDataSource.getRepository(User);
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
    user.password_hash = password;

    await userRepository.save(user);

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
      return; // Явный return вместо отправки Response
    }

    const user = await userRepository.findOne({
      where: { id: req.user.id },
      select: ['id', 'email', 'role', 'avatar_url']
    });

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    res.json(user); // Корректный возврат Response
  } catch (error) {
    console.error("Get user error:", error);
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