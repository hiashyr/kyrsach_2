import { Router } from 'express';
import ExamController from '../controllers/exam.controller';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

// Явно типизируем обработчик
router.post('/start', authMiddleware, (req, res, next) => {
  ExamController.startExam(req, res).catch(next);
});

export default router;