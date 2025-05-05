import { Request, Response } from 'express';
import ExamService from '../services/exam.service';

class ExamController {
  async startExam(req: Request, res: Response): Promise<void> { // Явно указываем возвращаемый тип
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return; // Явный return без значения
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
}

export default new ExamController();