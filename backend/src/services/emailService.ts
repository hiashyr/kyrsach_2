import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../config/logger';

dotenv.config();

// Усиленная проверка конфигурации
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASSWORD', 'FRONTEND_URL'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    const errorMsg = `Missing required environment variable: ${varName}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
});

// Проверка формата email
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  // Валидация получателя
  if (!options.to || !validateEmail(options.to)) {
    const errorMsg = `Invalid recipient email: ${options.to}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const mailOptions = {
    from: `"ПДД Тренажёр" <${process.env.EMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, '')
  };

  try {
    // В режиме разработки только логируем
    if (process.env.NODE_ENV === 'development') {
      logger.info('DEV MODE: Email would be sent', {
        to: options.to,
        subject: options.subject,
        link: options.html.match(/https?:\/\/[^\s]+/)?.[0]
      });
      return;
    }

    await transporter.sendMail(mailOptions);
    logger.info(`Email successfully sent to ${options.to}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Email sending failed', {
      error: errorMessage,
      recipient: options.to,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

export const sendPasswordResetEmail = async (
  email: string, 
  token: string, // Изменяем параметр с resetLink на token
  type: 'reset' | 'change' = 'reset'
) => {
  // Формируем полную ссылку
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}&type=${type}`;
  
  const subject = type === 'change' 
    ? 'Подтверждение смены пароля' 
    : 'Восстановление пароля';

  const actionText = type === 'change'
    ? 'Подтвердить смену пароля'
    : 'Сбросить пароль';

  const purposeText = type === 'change'
    ? 'подтверждения смены пароля'
    : 'сброса пароля';

  await sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #330570;">ПДД Тренажёр</h2>
          <h3 style="color: #333;">${subject}</h3>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin-bottom: 20px;">Для ${purposeText} в вашем аккаунте перейдите по кнопке ниже:</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; padding: 12px 24px;
                      background-color: #330570; color: white;
                      text-decoration: none; border-radius: 5px;
                      font-weight: bold; font-size: 16px;">
              ${actionText}
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            Если вы не можете нажать на кнопку, скопируйте и вставьте следующую ссылку в браузер:
          </p>
          <div style="word-break: break-all; font-size: 12px; color: #444; background-color: #f0f0f0; padding: 10px; border-radius: 4px;">
            ${resetLink}
          </div>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          <p>Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
          <p>Если вы не запрашивали ${purposeText}, проигнорируйте это сообщение.</p>
          <p>Ссылка действительна в течение 1 часа.</p>
        </div>
      </div>
    `,
    text: `
      ПДД Тренажёр
      ${subject}
      
      Для ${purposeText} перейдите по ссылке:
      ${resetLink}
      
      Ссылка действительна 1 час.
      Если вы не запрашивали ${purposeText}, проигнорируйте это сообщение.
    `
  });
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  if (!validateEmail(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  
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