import { Router } from 'express';
import { 
  forgotPassword, 
  resetPassword,
  verifyEmail
} from '../controllers/authController';
import { resendVerificationEmail } from '../controllers/userController';

const router = Router();

// Добавьте явные аннотации типов для маршрутов
router.post('/forgot-password', (req, res, next) => {
  forgotPassword(req, res).catch(next);
});

router.post('/reset-password', (req, res, next) => {
  resetPassword(req, res).catch(next);
});

router.get('/verify-email/:token', (req, res, next) => {
  verifyEmail(req, res).catch(next);
});

router.post('/resend-verification', (req, res, next) => {
  resendVerificationEmail(req, res).catch(next);
});

export default router;