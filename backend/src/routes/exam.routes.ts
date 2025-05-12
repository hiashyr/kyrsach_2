import { Router } from 'express';
import ExamController from '../controllers/exam.controller';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

// Старт экзамена
router.post('/start', authMiddleware, (req, res, next) => {
  ExamController.startExam(req, res).catch(next);
});

// Отправка ответа на вопрос
router.post('/:attemptId/answer', authMiddleware, (req, res, next) => {
  ExamController.submitAnswer(req, res).catch(next);
});

router.get('/stats', authMiddleware, ExamController.getUserStats);

// Завершение экзамена
router.post('/:attemptId/finish', authMiddleware, (req, res, next) => {
  ExamController.finishExam(req, res).catch(next);
});

// Получение результатов экзамена
router.get('/:attemptId/results', authMiddleware, (req, res, next) => {
  ExamController.getExamResults(req, res).catch(next);
});

// Запрос дополнительных вопросов (если есть ошибки)
router.post('/:attemptId/request-additional', authMiddleware, (req, res, next) => {
  ExamController.requestAdditionalQuestions(req, res).catch(next);
});

export default router;