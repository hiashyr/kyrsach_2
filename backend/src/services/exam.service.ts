import { AppDataSource } from '../config/data-source';
import { TestAttempt } from '../entities/TestAttempt';
import { Question } from '../entities/Question';

class ExamService {
  async startExam(userId: number) {
    try {
      const questions = await AppDataSource.getRepository(Question)
        .createQueryBuilder('question')
        .leftJoinAndSelect('question.answers', 'answers')
        .orderBy('RANDOM()')
        .limit(20)
        .getMany();

        const attempt = await AppDataSource.getRepository(TestAttempt).save({
            user: { id: userId },
            testType: 'exam',
            status: 'in_progress',
            totalQuestions: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            baseQuestionsCount: 20,
            additionalQuestionsAnswered: 0,
            startedAt: new Date()
          });

      return { 
        attemptId: attempt.id, 
        questions: questions.map(q => ({
          ...q,
          answers: q.answers.map(a => ({ id: a.id, text: a.text })) // Не возвращаем isCorrect
        }))
      };
    } catch (error) {
      console.error('ExamService.startExam error:', error);
      throw new Error('Failed to start exam');
    }
  }
}

export default new ExamService();