import { AppDataSource } from '../config/data-source';
import { TestAttempt } from '../entities/TestAttempt';
import { Question } from '../entities/Question';
import { Answer } from '../entities/Answer';
import { UserAnswer } from '../entities/UserAnswer';
import { Not, IsNull } from 'typeorm';
import { User } from '../entities/User';

interface AnswerSubmission {
  userId: number;
  attemptId: number;
  questionId: number;
  answerId: number;
}

interface ExamStartResult {
  attemptId: number;
  questions: Array<{
    id: number;
    text: string;
    imageUrl: string;
    topicId: number;
    isHard: boolean;
    createdAt: Date;
    answers: Array<{
      id: number;
      text: string;
    }>;
  }>;
}

interface AdditionalQuestionsResult {
  status: 'additional_required';
  questions: Array<{
    id: number;
    text: string;
    imageUrl: string;
    topicId: number;
    isHard: boolean;
    createdAt: Date;
    answers: Array<{
      id: number;
      text: string;
    }>;
  }>;
  timeLimit: number;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswerId: number | null;
  currentStats: {
    correct: number;
    incorrect: number;
  };
  requiresAdditionalQuestions?: boolean;
  additionalQuestions?: AdditionalQuestionsResult; // Добавляем
  timeLimit?: number;
}

interface ExamResults {
  status: 'passed' | 'failed' | 'in_progress';
  correctAnswers: number;
  incorrectAnswers: number;
  timeSpent: number;
  results: DetailedResult[];
}

interface AdditionalQuestionsResult {
  status: 'additional_required';
  questions: Array<{
    id: number;
    text: string;
    imageUrl: string;
    topicId: number;
    isHard: boolean;
    createdAt: Date;
    answers: Array<{
      id: number;
      text: string;
    }>;
  }>;
  timeLimit: number;
}

interface DetailedResult {
  questionId: number;
  questionText: string;
  userAnswerId: number;
  userAnswerText: string;
  isCorrect: boolean;
  correctAnswerId?: number;
  correctAnswerText?: string;
  timeSpent?: number;
}
interface UserStats {
  overall: {
    totalTests: number;
    averageScore: number;
    averageTime: number;
  };
  recent: TestAttempt[];
  examStats: {
    totalTests: number;
    averageScore: number;
    averageTime: number;
    lastAttempt?: TestAttempt;
  };
}

class ExamService {
  private testAttemptsRepository = AppDataSource.getRepository(TestAttempt);
  private shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
  async startExam(userId: number): Promise<ExamStartResult> {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      try {
          await queryRunner.startTransaction();

          // 1. Проверяем пользователя
          const user = await queryRunner.manager.findOne(User, {
              where: { id: userId },
              select: ['id']
          });
          
          if (!user) {
              throw new Error('Пользователь не найден');
          }

          // 2. Получаем ВСЕ вопросы с ответами сразу
          const allQuestions = await queryRunner.manager
              .createQueryBuilder(Question, 'question')
              .leftJoinAndSelect('question.answers', 'answers')
              .getMany();

          if (allQuestions.length < 20) {
              throw new Error(`Недостаточно вопросов в базе. Доступно: ${allQuestions.length}, требуется: 20`);
          }

          // 3. Перемешиваем вопросы и ответы
          const shuffledQuestions = this.shuffleArray(allQuestions).slice(0, 20);
          shuffledQuestions.forEach(question => {
              question.answers = this.shuffleArray(question.answers);
          });

          // 4. Создаем попытку тестирования
          const attempt = new TestAttempt();
          attempt.user = user;
          attempt.testType = 'exam';
          attempt.status = 'in_progress';
          attempt.totalQuestions = 20;
          attempt.baseQuestionsCount = 20;
          attempt.startedAt = new Date();
          
          const savedAttempt = await queryRunner.manager.save(attempt);

          // 5. Форматируем вопросы
          const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
          const defaultImage = `${baseUrl}/uploads/questions/default-question.jpg`;

          const formattedQuestions = shuffledQuestions.map(question => ({
            id: question.id,
            text: question.text,
            imageUrl: question.imageUrl 
              ? `${baseUrl}/uploads/questions/${question.imageUrl}`
              : defaultImage,
            topicId: question.topicId,
            isHard: question.isHard,
            createdAt: question.createdAt,
            answers: question.answers.map(answer => ({
              id: answer.id,
              text: answer.text
            }))
          }));
          await queryRunner.commitTransaction();

          return {
              attemptId: savedAttempt.id,
              questions: formattedQuestions
          };

      } catch (error) {
          await queryRunner.rollbackTransaction();
          console.error('ExamService.startExam error:', error);
          throw new Error(`Не удалось начать экзамен: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      } finally {
          await queryRunner.release();
      }
  }
  async processAnswer(data: AnswerSubmission): Promise<AnswerResult> {
      // Валидация входящих данных
      if (!data.attemptId || isNaN(Number(data.attemptId))) {
          throw new Error('Неверный ID попытки тестирования');
      }
      
      if (!data.questionId || isNaN(Number(data.questionId))) {
          throw new Error('Неверный ID вопроса');
      }
      
      if (!data.answerId || isNaN(Number(data.answerId))) {
          throw new Error('Неверный ID ответа');
      }
      
      if (!data.userId || isNaN(Number(data.userId))) {
          throw new Error('Неверный ID пользователя');
      }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
        await queryRunner.startTransaction();

        // 1. Получаем попытку с блокировкой (без JOIN)
        const attempt = await queryRunner.manager.findOne(TestAttempt, {
            where: { 
                id: Number(data.attemptId), 
                user: { id: Number(data.userId) } 
            },
            lock: { mode: "pessimistic_write" }
        });
        
        if (!attempt) {
            throw new Error(`Попытка тестирования ${data.attemptId} не найдена`);
        }

        // 2. Проверяем статус экзамена
        if (attempt.status !== 'in_progress') {
            throw new Error('Экзамен уже завершён');
        }

        // 3. Получаем вопрос и ответ
        const [question, answer, userAnswers] = await Promise.all([
            queryRunner.manager.findOne(Question, {
                where: { id: Number(data.questionId) }
            }),
            queryRunner.manager.findOne(Answer, {
                where: { 
                    id: Number(data.answerId),
                    question: { id: Number(data.questionId) } 
                }
            }),
            queryRunner.manager.find(UserAnswer, {
                where: { attempt: { id: attempt.id } },
                relations: ['question']
            })
        ]);

        if (!question) throw new Error(`Вопрос ${data.questionId} не найден`);
        if (!answer) throw new Error(`Ответ ${data.answerId} не найден`);

        // 4. Сохраняем ответ пользователя
        const userAnswer = new UserAnswer();
        userAnswer.attempt = attempt;
        userAnswer.question = question;
        userAnswer.answer = answer;
        userAnswer.isCorrect = answer.isCorrect;
        
        await queryRunner.manager.save(userAnswer);

        // 5. Получаем обновленную статистику
        const correctAnswers = userAnswers.filter(ua => ua.isCorrect).length + (answer.isCorrect ? 1 : 0);
        const incorrectAnswers = userAnswers.length + 1 - correctAnswers;
        const totalAnswered = userAnswers.length + 1;

        // 6. Проверяем необходимость дополнительных вопросов
        const requiresAdditional = (incorrectAnswers === 1 || incorrectAnswers === 2) && 
                                 totalAnswered === attempt.baseQuestionsCount;

        let additionalQuestions: AdditionalQuestionsResult | null = null;
        
        if (requiresAdditional) {
            const additionalCount = incorrectAnswers === 1 ? 5 : 10;
            
            // Получаем ID уже отвеченных вопросов
            const answeredIds = userAnswers.map(ua => ua.question.id);
            answeredIds.push(question.id);

            // Выбираем новые вопросы
            const questions = await queryRunner.manager
                .createQueryBuilder(Question, 'question')
                .leftJoinAndSelect('question.answers', 'answers')
                .where('question.id NOT IN (:...answeredIds)', { answeredIds })
                .orderBy('RANDOM()')
                .limit(additionalCount)
                .getMany();

            // Обновляем попытку
            await queryRunner.manager.update(TestAttempt, attempt.id, {
                additionalQuestionsAnswered: additionalCount,
                totalQuestions: attempt.baseQuestionsCount + additionalCount
            });

            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            const defaultImage = `${baseUrl}/images/default-question.jpg`;

            additionalQuestions = {
                status: 'additional_required',
                questions: questions.map(q => ({
                    id: q.id,
                    text: q.text,
                    imageUrl: q.imageUrl ? `${baseUrl}/uploads/questions/${q.imageUrl}` : defaultImage,
                    topicId: q.topicId,
                    isHard: q.isHard,
                    createdAt: q.createdAt,
                    answers: q.answers.map(a => ({ id: a.id, text: a.text }))
                })),
                timeLimit: additionalCount * 60
            };
        }

        // 7. Обновляем статистику попытки
        const updateData: Partial<TestAttempt> = {
            correctAnswers,
            incorrectAnswers,
            timeSpentSeconds: Math.floor(
                (new Date().getTime() - new Date(attempt.startedAt as Date).getTime()) / 1000
            )
        };

        await queryRunner.manager.update(TestAttempt, attempt.id, updateData);
        await queryRunner.commitTransaction();

        // 8. Формируем результат
        return {
            isCorrect: answer.isCorrect,
            correctAnswerId: answer.isCorrect ? null : answer.id,
            currentStats: { correct: correctAnswers, incorrect: incorrectAnswers },
            requiresAdditionalQuestions: requiresAdditional,
            ...(additionalQuestions && { additionalQuestions })
        };
        
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('Ошибка обработки ответа:', error);
        throw error;
    } finally {
        await queryRunner.release();
    }
}

  async completeExam(attempt: TestAttempt): Promise<ExamResults> {
    try {
      // Обновляем время выполнения
      const timeSpent = attempt.startedAt 
        ? Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000)
        : 0;

      // Определяем статус экзамена
      const errorCount = attempt.incorrectAnswers || 0;
      const status = errorCount >= 3 ? 'failed' : 'passed';

      // Обновляем попытку
      await AppDataSource.getRepository(TestAttempt).update(attempt.id, {
        status,
        completedAt: new Date(),
        timeSpentSeconds: timeSpent
      });

      // Получаем обновленные данные
      const updatedAttempt = await AppDataSource.getRepository(TestAttempt).findOneBy({ 
        id: attempt.id 
      });

      if (!updatedAttempt) {
        throw new Error('Attempt not found');
      }

      return {
        status: updatedAttempt.status,
        correctAnswers: updatedAttempt.correctAnswers || 0,
        incorrectAnswers: updatedAttempt.incorrectAnswers || 0,
        timeSpent: updatedAttempt.timeSpentSeconds || 0,
        results: await this.getDetailedResults(attempt.id)
      };
    } catch (error) {
      console.error('ExamService.completeExam error:', error);
      throw error;
    }
  }

  private calculateTimeLimit(attempt: TestAttempt): number {
    // 1 минута на вопрос (60 секунд)
    return attempt.totalQuestions * 60;
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const attempts = await this.testAttemptsRepository.find({
      where: { user: { id: userId }, completedAt: Not(IsNull()) },
      order: { completedAt: 'DESC' }
    });

    return {
      overall: this.calculateOverallStats(attempts),
      recent: attempts.slice(0, 20),
      examStats: this.calculateExamStats(attempts)
    };
  }

  private calculateOverallStats(attempts: TestAttempt[]) {
    const totalCorrect = attempts.reduce((sum, a) => sum + a.correctAnswers, 0);
    const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
    
    return {
      totalTests: attempts.length,
      averageScore: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      averageTime: Math.round(attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / attempts.length) || 0
    };
  }

  private calculateExamStats(attempts: TestAttempt[]) {
    const exams = attempts.filter(a => a.testType === 'exam');
    const stats = this.calculateOverallStats(exams);
    
    return {
      ...stats,
      lastAttempt: exams[0]
    };
  }

  private async getAdditionalQuestions(
    attemptId: number, 
    errorCount: number, 
    userId: number
  ): Promise<AdditionalQuestionsResult> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const additionalCount = errorCount === 1 ? 5 : 10;
      const answeredQuestions = await this.getAnsweredQuestionIds(attemptId);

      // Проверяем доступность вопросов
      const totalQuestions = await queryRunner.manager.count(Question);
      if (totalQuestions - answeredQuestions.length < additionalCount) {
        throw new Error('Недостаточно вопросов для дополнительного тестирования');
      }

      // Получаем новые вопросы
      const questions = await queryRunner.manager
        .createQueryBuilder(Question, 'question')
        .leftJoinAndSelect('question.answers', 'answers')
        .where('question.id NOT IN (:...answered)', { answered: answeredQuestions })
        .orderBy('RANDOM()')
        .limit(additionalCount)
        .getMany();

      // Обновляем попытку
      await queryRunner.manager.update(TestAttempt, attemptId, {
        additionalQuestionsAnswered: additionalCount,
        totalQuestions: 20 + additionalCount,
        startedAt: new Date(),
      });

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const defaultImage = `${baseUrl}/images/default-question.jpg`;

      await queryRunner.commitTransaction();

      return {
        status: 'additional_required',
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl ? `${baseUrl}/uploads/questions/${q.imageUrl}` : defaultImage,
          topicId: q.topicId,
          isHard: q.isHard,
          createdAt: q.createdAt,
          answers: q.answers.map(a => ({
            id: a.id,
            text: a.text
          }))
        })),
        timeLimit: additionalCount * 60 // 1 минута на вопрос
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('ExamService.getAdditionalQuestions error:', error);
      throw new Error('Failed to get additional questions: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      await queryRunner.release();
    }
  }
  async getExamResults(attemptId: number, userId: number): Promise<ExamResults> {
    try {
      const attempt = await AppDataSource.getRepository(TestAttempt).findOne({
        where: { id: attemptId, user: { id: userId } },
      });

      if (!attempt) throw new Error('Attempt not found');

      const results = await this.getDetailedResults(attemptId);

      return {
        status: attempt.status,
        correctAnswers: attempt.correctAnswers,
        incorrectAnswers: attempt.incorrectAnswers,
        timeSpent: attempt.timeSpentSeconds,
        results,
      };
    } catch (error) {
      console.error('ExamService.getExamResults error:', error);
      throw new Error('Failed to get exam results: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async getCorrectAnswerId(questionId: number): Promise<number> {
    const answer = await AppDataSource.getRepository(Answer).findOne({
      where: { question: { id: questionId }, isCorrect: true },
      select: ['id']
    });
    return answer?.id || -1;
  }

  private async getAnsweredQuestionIds(attemptId: number): Promise<number[]> {
    const userAnswers = await AppDataSource.getRepository(UserAnswer)
      .find({
        where: { attempt: { id: attemptId } },
        relations: ['question'],
        select: ['question']
      });

    return userAnswers.map(answer => answer.question.id);
  }

  private async getDetailedResults(attemptId: number): Promise<DetailedResult[]> {
    const userAnswers = await AppDataSource.getRepository(UserAnswer)
      .find({
        where: { attempt: { id: attemptId } },
        relations: ['question', 'answer'],
        order: { createdAt: 'ASC' }
      });

    return Promise.all(userAnswers.map(async (ua) => {
      const correctAnswer = await AppDataSource.getRepository(Answer)
        .findOne({
          where: { 
            question: { id: ua.question.id },
            isCorrect: true 
          }
        });

      return {
        questionId: ua.question.id,
        questionText: ua.question.text,
        userAnswerId: ua.answer.id,
        userAnswerText: ua.answer.text,
        isCorrect: ua.isCorrect,
        correctAnswerId: correctAnswer?.id,
        correctAnswerText: correctAnswer?.text
      };
    }));
  }
}

export default new ExamService();