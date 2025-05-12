import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Question } from '../entities/Question';

class QuestionController {
  async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const questionId = parseInt(req.params.id);
      const question = await AppDataSource.getRepository(Question).findOneBy({ id: questionId });
      
      if (!question) {
        res.status(404).json({ error: 'Вопрос не найден' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Изображение не загружено' });
        return;
      }

      question.imageUrl = req.file.filename;
      await AppDataSource.getRepository(Question).save(question);

      res.json({
        success: true,
        imageUrl: `${process.env.BASE_URL}/uploads/questions/${req.file.filename}`
      });
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
      res.status(500).json({ error: 'Ошибка загрузки изображения' });
    }
  }
}

export default QuestionController;