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
        emailExists: false, // Явно указываем что email не существует
        message: "Email не найден в системе"
      });
      return;
    }

    // Удаляем старые токены
    await resetTokenRepository.delete({ user: { id: user.id } });

    // Создаем новый токен
    const token = crypto.randomBytes(32).toString('hex');
    await resetTokenRepository.save({
      user,
      token,
      expiresAt: new Date(Date.now() + 3600000), // 1 час
      isUsed: false
    });

    // Отправляем письмо
    await sendPasswordResetEmail(user.email, token);

    res.json({ 
      success: true,
      emailExists: true, // Явно указываем что email существует
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


export const requestPasswordChange = async (req: Request, res: Response) => {
  try {
    const { currentPassword, email } = req.body;
    
    // 1. Находим пользователя с email
    const user = await userRepository.findOne({ 
      where: { email },
      select: ['id', 'password_hash', 'email']
    });

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    // 2. Проверяем пароль
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "INVALID_PASSWORD" });
    }

    // 3. Удаляем старые токены
    await resetTokenRepository.delete({ user: { id: user.id } });

    // 4. Создаем новый токен
    const token = crypto.randomBytes(32).toString('hex');
    await resetTokenRepository.save({
      user,
      token,
      expiresAt: new Date(Date.now() + 3600000), // 1 час
      isUsed: false
    });

    // 5. Отправляем письмо
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&type=change`;
    await sendPasswordResetEmail(user.email, resetLink, 'change');

    return res.json({ success: true });
  } catch (error: unknown) { // Явно указываем тип unknown
    console.error('Password change request error:', error);
    
    let errorMessage = "Internal server error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return res.status(500).json({ 
      error: "SERVER_ERROR",
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error instanceof Error ? error.stack : undefined 
      })
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      res.status(400).json({ 
        error: "MISSING_DATA",
        message: "Токен и новый пароль обязательны" 
      });
      return;
    }

    const resetToken = await resetTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      res.status(400).json({
        error: "INVALID_TOKEN",
        message: "Недействительная ссылка для сброса пароля"
      });
      return;
    }

    if (resetToken.expiresAt < new Date()) {
      res.status(400).json({
        error: "TOKEN_EXPIRED",
        message: "Срок действия ссылки истёк. Запросите новую."
      });
      return;
    }

    if (resetToken.isUsed) {
      res.status(400).json({
        error: "TOKEN_ALREADY_USED",
        message: "Эта ссылка уже была использована. Ваш пароль был изменён ранее."
      });
      return;
    }

    // Обновление пароля
    resetToken.user.password_hash = newPassword;
    await userRepository.save(resetToken.user);

    // Помечаем токен как использованный
    resetToken.isUsed = true;
    await resetTokenRepository.save(resetToken);

    res.json({ 
      success: true,
      message: "Пароль успешно обновлён" 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "Ошибка сервера при сбросе пароля"
    });
  }
};

export const checkToken = async (req: Request, res: Response) => {
  const { token } = req.body;
  
  const resetToken = await resetTokenRepository.findOne({ 
    where: { token },
    relations: ['user']
  });

  if (!resetToken) {
    return res.json({ status: 'invalid' });
  }

  if (resetToken.isUsed) {
    return res.json({ status: 'used' });
  }

  if (resetToken.expiresAt < new Date()) {
    return res.json({ status: 'expired' });
  }

  res.json({ status: 'valid' });
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

    // 1. Попробуем найти токен в базе данных
    const verificationToken = await tokenRepository.findOne({
      where: { token },
      relations: ['user']
    });

    // 2. Если токен найден
    if (verificationToken) {
      const user = verificationToken.user;

      // 2a. Проверяем срок действия токена
      if (verificationToken.expiresAt < new Date()) {
        await tokenRepository.delete({ id: verificationToken.id });
        return res.status(400).json({ 
          success: false,
          error: "Срок действия токена истёк" 
        });
      }

      // 2b. Если пользователь уже подтвержден
      if (user.isVerified) {
        await tokenRepository.delete({ id: verificationToken.id });
        return res.json({ 
          success: true,
          message: "Этот email уже был подтверждён ранее",
          email: user.email,
          alreadyVerified: true
        });
      }

      // 2c. Подтверждаем email
      user.isVerified = true;
      await userRepository.save(user);
      await tokenRepository.delete({ id: verificationToken.id });

      return res.json({ 
        success: true,
        message: "Email успешно подтверждён!",
        email: user.email
      });
    }

    // 3. Если токен не найден, проверяем есть ли пользователь с таким email, который уже подтвержден
    const userWithToken = await userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.emailVerificationTokens", "token")
      .where("token.token = :token", { token })
      .getOne();

    if (userWithToken?.isVerified) {
      return res.json({ 
        success: true,
        message: "Этот email уже был подтверждён ранее",
        email: userWithToken.email,
        alreadyVerified: true
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