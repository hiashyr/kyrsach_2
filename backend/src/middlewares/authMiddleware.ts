import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";

export default async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      res.status(401).json({ error: "Требуется авторизация" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number };
    const user = await AppDataSource.getRepository(User).findOne({ 
      where: { id: decoded.id } 
    });

    if (!user) {
      res.status(401).json({ error: "Пользователь не найден" });
      return;
    }

    // Добавляем пользователя в запрос
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Неверный токен" });
  }
}