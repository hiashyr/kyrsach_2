import { Router } from 'express';
import TopicController from '../controllers/topic.controller';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, (req, res) => TopicController.getTopics(req, res));
router.post('/:topicId/start', authMiddleware, (req, res) => TopicController.startTopicTest(req, res));
router.get('/:topicId/attempt/:attemptId', authMiddleware, TopicController.getAttempt);
router.post('/:topicId/attempt/:attemptId/answer', authMiddleware, TopicController.submitAnswer);

export default router;