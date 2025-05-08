import { Request, Response } from 'express';
import ExamService from '../services/exam.service';
import { AppDataSource } from '../config/data-source';
import { TestAttempt } from '../entities/TestAttempt';

class ExamController {
  async startExam(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await ExamService.startExam(req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Exam start error:', error);
      res.status(500).json({
        error: 'Exam start failed',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      });
    }
  }

  async submitAnswer(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { attemptId, questionId, answerId } = req.body;
      
      const result = await ExamService.processAnswer({
        userId: req.user.id,
        attemptId,
        questionId,
        answerId
      });

      res.json(result);
    } catch (error) {
      console.error('Answer submission error:', error);
      res.status(500).json({
        error: 'Answer submission failed',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      });
    }
  }

  async finishExam(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { attemptId } = req.params;
      const attemptRepository = AppDataSource.getRepository(TestAttempt);
      
      const attempt = await attemptRepository.findOne({
        where: { id: Number(attemptId), user: { id: req.user.id } },
        relations: ['user']
      });

      if (!attempt) {
        res.status(404).json({ error: 'Attempt not found' });
        return;
      }

      const result = await ExamService.completeExam(attempt);
      res.json(result);
    } catch (error) {
      console.error('Exam completion error:', error);
      res.status(500).json({
        error: 'Exam completion failed',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      });
    }
  }

  async getExamResults(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { attemptId } = req.params;
      const result = await ExamService.getExamResults(
        Number(attemptId),
        req.user.id
      );

      if (!result) {
        res.status(404).json({ error: 'Results not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Get exam results error:', error);
      res.status(500).json({
        error: 'Failed to get exam results',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      });
    }
  }

  async requestAdditionalQuestions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { attemptId } = req.params;
      const attemptRepository = AppDataSource.getRepository(TestAttempt);
      
      const attempt = await attemptRepository.findOne({
        where: { id: Number(attemptId), user: { id: req.user.id } }
      });

      if (!attempt) {
        res.status(404).json({ error: 'Attempt not found' });
        return;
      }

      const result = await ExamService.completeExam(attempt);
      res.json(result);
    } catch (error) {
      console.error('Request additional questions error:', error);
      res.status(500).json({
        error: 'Failed to request additional questions',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      });
    }
  }
}

export default new ExamController();