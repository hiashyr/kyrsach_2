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
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number };
    const user = await AppDataSource.getRepository(User).findOne({ 
      where: { id: decoded.id },
      relations: ['emailVerificationTokens', 'resetTokens'] // Добавляем нужные связи
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = user; // Присваиваем полный объект пользователя
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
}