// src/controllers/authController.ts
import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { EmailVerificationToken } from '../entities/EmailVerificationToken';
import { PasswordResetToken } from "../entities/PasswordResetTokens";
import { sendPasswordResetEmail } from "../services/emailService"
import crypto from 'crypto';
import logger from '../config/logger'; // Убедитесь, что путь правильный

const userRepository = AppDataSource.getRepository(User);
const resetTokenRepository = AppDataSource.getRepository(PasswordResetToken);

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      res.status(200).json({ 
        success: true,
        message: "Если email существует, письмо отправлено" 
      });
      return; // Просто return без значения
    }

    // Остальной код без изменений
    await resetTokenRepository.delete({ user: { id: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    await resetTokenRepository.save({
      user,
      token,
      expiresAt: new Date(Date.now() + 3600000),
      isUsed: false
    });

    await sendPasswordResetEmail(user.email, token);

    res.json({ 
      success: true,
      message: "Письмо с инструкциями отправлено" 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false,
      error: "Ошибка сервера"
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    
    // Валидация
    if (!token || !newPassword) {
      res.status(400).json({ 
        success: false,
        error: "Токен и новый пароль обязательны" 
      });
      return;
    }

    // Проверяем токен
    const resetToken = await resetTokenRepository.findOne({
      where: { 
        token, 
        isUsed: false 
      },
      relations: ['user'],
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      res.status(400).json({ 
        success: false,
        error: "Недействительный или просроченный токен" 
      });
      return;
    }

    // Обновляем пароль (хеширование произойдет в @BeforeUpdate)
    resetToken.user.password_hash = newPassword;
    await userRepository.save(resetToken.user);

    // Помечаем токен как использованный
    resetToken.isUsed = true;
    await resetTokenRepository.save(resetToken);

    res.json({ 
      success: true,
      message: "Пароль успешно обновлен" 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: "Ошибка сервера",
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const token = req.query.token || req.body.token;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: "Токен обязателен" 
    });
  }

  try {
    const tokenRepository = AppDataSource.getRepository(EmailVerificationToken);
    const userRepository = AppDataSource.getRepository(User);

    // 1. Находим пользователя по токену (даже если токен удалён)
    const userWithToken = await userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.emailVerificationTokens", "token")
      .where("token.token = :token", { token })
      .getOne();

    // 2. Если пользователь найден и уже подтверждён
    if (userWithToken?.isVerified) {
      return res.json({ 
        success: true,
        message: "Этот email уже был подтверждён ранее",
        email: userWithToken.email,
        alreadyVerified: true // Флаг для фронтенда
      });
    }

    // 3. Если есть неподтверждённый пользователь с таким токеном
    if (userWithToken) {
      userWithToken.isVerified = true;
      await userRepository.save(userWithToken);
      await tokenRepository.delete({ token });
      
      return res.json({ 
        success: true,
        message: "Email успешно подтверждён!",
        email: userWithToken.email
      });
    }

    // 4. Если ничего не найдено
    return res.status(400).json({ 
      success: false,
      error: "Недействительный токен подтверждения" 
    });

  } catch (error) {
    logger.error('Verification failed', error);
    return res.status(500).json({ 
      success: false,
      error: "Ошибка сервера"
    });
  }
};