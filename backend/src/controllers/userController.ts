import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";

const userRepository = AppDataSource.getRepository(User);

// Расширяем интерфейс Request для добавления пользователя
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Регистрация
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Проверка на существующего пользователя
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: "Email уже используется" });
      return;
    }

    // Создание пользователя
    const user = new User();
    user.email = email;
    user.password_hash = password;

    await userRepository.save(user);

    // Генерация токена
    const token = generateToken(user);

    res.status(201).json({ token });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Ошибка регистрации" });
  }
};

// Авторизация
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Поиск пользователя
    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Неверные учетные данные" });
      return;
    }

    // Проверка пароля
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Неверные учетные данные" });
      return;
    }

    // Генерация токена
    const token = generateToken(user);

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Ошибка авторизации" });
  }
};

// Получение текущего пользователя
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Пользователь не авторизован" });
      return;
    }
    res.json({ user: req.user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// Получение списка пользователей
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userRepository.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Вспомогательная функция для генерации JWT
function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "24h" }
  );
}