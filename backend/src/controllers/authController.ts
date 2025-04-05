import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { PasswordResetToken } from '../entities/PasswordResetTokens';
import { sendPasswordResetEmail } from '../services/emailService';
import crypto from 'crypto';

const userRepository = AppDataSource.getRepository(User);
const resetTokenRepository = AppDataSource.getRepository(PasswordResetToken);

export const forgotPassword = async (req: Request, res: Response) => {
    console.log('Получен запрос на', req.url);
    try {
        const { email } = req.body;
        const user = await userRepository.findOne({ where: { email } });

        if (!user) {
            res.status(200).json({ message: "Если email существует, письмо отправлено" });
            return;
        }

        // Удаление старых токенов с правильным именем поля
        await resetTokenRepository.delete({ user: { id: user.id } });

        const token = crypto.randomBytes(32).toString('hex');
        await resetTokenRepository.save({
            user,
            token,
            expiresAt: new Date(Date.now() + 3600000), // Используем expiresAt вместо expires_at
            isUsed: false // Используем isUsed вместо is_used
        });

        await sendPasswordResetEmail(user.email, token);
        res.json({ message: "Письмо отправлено" });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      res.status(400).json({ error: "Токен и новый пароль обязательны" });
      return;
    }

    const resetToken = await resetTokenRepository.findOne({
      where: { 
        token, 
        isUsed: false 
      },
      relations: ['user'],
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: "Недействительный или просроченный токен" });
      return;
    }

    // Обновляем пароль
    resetToken.user.password_hash = newPassword;
    await userRepository.save(resetToken.user);

    // Помечаем токен как использованный
    resetToken.isUsed = true;
    await resetTokenRepository.save(resetToken);

    res.json({ message: "Пароль успешно обновлен" });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: "Ошибка сервера",
      ...(process.env.NODE_ENV === 'development' && { details: error instanceof Error ? error.message : 'Unknown error' })
    });
  }
};