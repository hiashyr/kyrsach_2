import { Request, Response } from 'express';
import TopicService from '../services/topic.service';

class TopicController {
    async getTopics(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
        }

        const topics = await TopicService.getTopicsWithProgress(req.user.id);
        
        // Явно указываем, что возвращаем массив
        res.status(200).json(topics || []);
    } catch (error) {
        console.error('Get topics error:', error);
        res.status(500).json({ 
        error: 'Failed to get topics',
        details: error instanceof Error ? error.message : undefined
        });
    }
    }

    async startTopicTest(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
            }

            const { topicId } = req.params;
            const result = await TopicService.startTopicTest(req.user.id, Number(topicId));
            
            // Явно возвращаем объект с attemptId
            res.json({
            success: true,
            data: {
                attemptId: result.attemptId,
                topicName: result.topicName,
                questions: result.questions
            }
            });
        } catch (error) {
            console.error('Start topic test error:', error);
            res.status(500).json({ 
            error: 'Failed to start topic test',
            details: error instanceof Error ? error.message : undefined
            });
        }
    }

    async getAttempt(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
            }

            const { topicId, attemptId } = req.params;
            
            // Явное преобразование к числу
            const parsedAttemptId = parseInt(attemptId, 10);
            const parsedTopicId = parseInt(topicId, 10);
            
            if (isNaN(parsedAttemptId) || isNaN(parsedTopicId)) {
            res.status(400).json({ error: 'Invalid attempt or topic ID' });
            return;
            }

            const attempt = await TopicService.getAttempt(
            parsedTopicId,
            parsedAttemptId,
            req.user.id
            );
            
            res.json(attempt);
        } catch (error) {
            console.error('Get attempt error:', error);
            res.status(500).json({ 
            error: 'Failed to get attempt',
            details: error instanceof Error ? error.message : undefined
            });
        }
    }

    async submitAnswer(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
            }

            const { topicId, attemptId } = req.params;
            const { questionId, answerId } = req.body;
            
            const result = await TopicService.submitAnswer(
            Number(topicId),
            Number(attemptId),
            Number(questionId),
            Number(answerId),
            req.user.id
            );
            
            res.json(result);
        } catch (error) {
            console.error('Submit answer error:', error);
            res.status(500).json({ 
            error: 'Failed to submit answer',
            details: error instanceof Error ? error.message : undefined
            });
        }
        }
}

export default new TopicController();