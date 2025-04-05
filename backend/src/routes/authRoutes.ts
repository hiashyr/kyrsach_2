import { Router } from 'express';
import { forgotPassword, resetPassword } from '../controllers/authController'; // Добавляем импорт

const router = Router();

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword); // Добавляем новый endpoint

export default router;