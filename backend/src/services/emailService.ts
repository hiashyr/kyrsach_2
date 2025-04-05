// src/services/emailService.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Проверка обязательных переменных
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  throw new Error('Email credentials not configured in .env');
}

const transporter = nodemailer.createTransport({
  service: 'gmail', // Явно указываем gmail (регистр не важен)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL not configured');
  }

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"Тесты ПДД" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Восстановление пароля',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #330570;">Восстановление пароля</h2>
        <p>Для сброса пароля перейдите по ссылке:</p>
        <a href="${resetLink}" 
           style="display: inline-block; padding: 10px 20px; background-color: #330570; color: white; text-decoration: none; border-radius: 5px;">
          Сбросить пароль
        </a>
        <p style="margin-top: 20px; color: #666;">
          Ссылка действительна 1 час. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};