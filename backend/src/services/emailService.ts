import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../config/logger';

dotenv.config();

// Проверка конфигурации
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASSWORD', 'FRONTEND_URL'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    logger.error(`Missing required environment variable: ${varName}`);
    throw new Error(`Missing ${varName} in .env configuration`);
  }
});

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Для локального dev-окружения
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: `"ПДД Тренажёр" <${process.env.EMAIL_USER}>`,
    ...options
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.to}`, { 
      subject: options.subject 
    });
  } catch (error) {
    logger.error('Email sending failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      recipient: options.to
    });
    throw new Error('Failed to send email');
  }
};

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: email,
    subject: 'Восстановление пароля',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #330570;">Восстановление пароля</h2>
        <p>Для сброса пароля перейдите по ссылке:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; padding: 12px 24px;
                    background-color: #330570; color: white;
                    text-decoration: none; border-radius: 5px;
                    font-weight: bold;">
            Сбросить пароль
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Ссылка действительна 1 час. Если вы не запрашивали сброс пароля,
          проигнорируйте это письмо.
        </p>
        <p style="color: #666; font-size: 14px;">
          Если кнопка не работает, скопируйте ссылку:<br>
          <span style="word-break: break-all;">${resetLink}</span>
        </p>
      </div>
    `,
    text: `Для сброса пароля перейдите по ссылке: ${resetLink}`
  });
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.error('Invalid email format', { email });
    throw new Error('Неверный формат email');
  }

  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  console.log('Sending verification link:', verificationLink);
  await sendEmail({
    to: email,
    subject: 'Подтверждение email для ПДД Тренажёра',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #330570; text-align: center;">Подтверждение email</h2>
        <p style="text-align: center;">Для завершения регистрации нажмите кнопку:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${verificationLink}"
             style="display: inline-block; padding: 12px 24px;
                    background-color: #330570; color: white;
                    text-decoration: none; border-radius: 5px;
                    font-weight: bold;">
            Подтвердить email
          </a>
        </div>
        <p style="color: #666; font-size: 14px; text-align: center;">
          Ссылка действительна 24 часа.
        </p>
      </div>
    `,
    text: `Для подтверждения email перейдите по ссылке: ${verificationLink}`
  });
};