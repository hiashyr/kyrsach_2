// src/controllers/authController.ts
import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { EmailVerificationToken } from '../entities/EmailVerificationToken';
import { PasswordResetToken } from "../entities/PasswordResetTokens";
import { sendPasswordResetEmail } from "../services/emailService"
import crypto from 'crypto';

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
  const { token } = req.params;

  try {
    const tokenRepository = AppDataSource.getRepository(EmailVerificationToken);
    const userRepository = AppDataSource.getRepository(User);

    // Находим токен
    const verificationToken = await tokenRepository.findOne({
      where: { token },
      relations: ["user"],
    });

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      return res.status(400).json({ error: "Недействительный или просроченный токен" });
    }

    // Помечаем пользователя как подтверждённого
    verificationToken.user.isVerified = true;
    await userRepository.save(verificationToken.user);

    // Удаляем токен
    await tokenRepository.delete(verificationToken.id);

    res.json({ success: true, message: "Email подтверждён!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};