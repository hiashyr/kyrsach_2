import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { IsEmail, IsString, MinLength } from 'class-validator';

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

    await userRepository.save(user);

    const token = generateToken(user);

    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url
      }
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
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role // Добавляем роль в ответ
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

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: "UNAUTHORIZED",
        message: "Требуется авторизация" 
      });
      return;
    }
    
    // Обновляем данные пользователя из БД
    const currentUser = await userRepository.findOne({ 
      where: { id: req.user.id },
      select: ['id', 'email', 'role', 'avatar_url', 'createdAt']
    });

    if (!currentUser) {
      res.status(404).json({ 
        error: "USER_NOT_FOUND",
        message: "Пользователь не найден" 
      });
      return;
    }

    res.json({ user: currentUser });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR",
      message: "Ошибка сервера" 
    });
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

function generateToken(user: User): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET!,
    { expiresIn: "24h" }
  );
}