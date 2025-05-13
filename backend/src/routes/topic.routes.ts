import { Router } from 'express';
import TopicController from '../controllers/topic.controller';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

// Применяем authMiddleware ко всем роутам
router.use(authMiddleware);

// Роуты для работы с темами
router.get('/', TopicController.getTopics);

// Роуты для тестирования по теме
router.post('/:topicId/start', TopicController.startTopicTest);
router.get('/:topicId/attempt/:attemptId', TopicController.getAttempt);
router.post('/:topicId/attempt/:attemptId/answer', TopicController.submitAnswer);

// Роуты для завершения и результатов теста
router.post('/:topicId/attempt/:attemptId/finish', TopicController.finishAttempt);
router.get('/:topicId/attempt/:attemptId/results', TopicController.getAttemptResults);

export default router;