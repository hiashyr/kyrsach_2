import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { IsEmail, IsString, MinLength } from 'class-validator';
import { sendVerificationEmail } from '../services/emailService';
import crypto from 'crypto';
import { EmailVerificationToken } from '../entities/EmailVerificationToken';

// Добавьте эти классы сразу после импортов:
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

    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      res.status(400).json({ 
        error: "EMAIL_EXISTS",
        message: "Email уже используется",
        field: "email"
      });
      return;
    }

    const user = new User();
    user.email = email;
    user.password_hash = password;
    user.isVerified = false; // Явно указываем, что email не подтверждён

    await userRepository.save(user);

    // Генерируем токен подтверждения
    const token = crypto.randomBytes(32).toString('hex');
    const verificationToken = new EmailVerificationToken();
    verificationToken.token = token;
    verificationToken.user = user;
    verificationToken.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await AppDataSource.getRepository(EmailVerificationToken).save(verificationToken);

    // Отправляем письмо
    await sendVerificationEmail(user.email, token);

    res.status(201).json({ 
      success: true,
      message: "Регистрация успешна. Проверьте email для подтверждения.",
      email: user.email
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка при регистрации" 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const loginDto = plainToClass(LoginDto, req.body);
    const errors = await validate(loginDto);

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

    const { email, password } = loginDto;

    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ 
        error: "INVALID_CREDENTIALS",
        message: "Неверный email или пароль",
        field: "email"
      });
      return;
    }

    // Проверяем, подтверждён ли email
    if (!user.isVerified) {
      res.status(403).json({
        error: "EMAIL_NOT_VERIFIED",
        message: "Email не подтверждён. Проверьте вашу почту.",
        email: user.email
      });
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ 
        error: "INVALID_CREDENTIALS",
        message: "Неверный email или пароль",
        field: "password"
      });
      return;
    }

    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      },
      redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/'
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка при авторизации" 
    });
  }
};

// userController.ts
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: "EMAIL_ALREADY_VERIFIED" });
      return;
    }

    // Удаляем старые токены
    await AppDataSource.getRepository(EmailVerificationToken)
      .delete({ user: { id: user.id } });

    // Создаём новый токен
    const token = crypto.randomBytes(32).toString('hex');
    const verificationToken = new EmailVerificationToken();
    verificationToken.token = token;
    verificationToken.user = user;
    verificationToken.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await AppDataSource.getRepository(EmailVerificationToken).save(verificationToken);

    // Отправляем письмо
    await sendVerificationEmail(user.email, token);

    res.json({ success: true, message: "Письмо отправлено повторно" });
  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({ error: "SERVER_ERROR" });
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
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      isVerified: user.isVerified
    },
    process.env.JWT_SECRET!,
    { expiresIn: "24h" }
  );
}