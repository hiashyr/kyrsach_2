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
  questions: Array<
    Omit<Question, 'answers'> & {
      answers: Array<Pick<Answer, 'id' | 'text'>>;
    }
  >;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswerId: number | null;
  currentStats: {
    correct: number;
    incorrect: number;
  };
  requiresAdditionalQuestions?: boolean;
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
  questions: Array<Omit<Question, 'answers'> & {
    answers: Array<Pick<Answer, 'id' | 'text'>>
  }>;
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

          // 2. Получаем случайные вопросы в два этапа
          // Сначала получаем ID случайных вопросов
          const randomQuestionIds = await queryRunner.manager
              .createQueryBuilder(Question, 'question')
              .select('question.id')
              .orderBy('RANDOM()')
              .take(20)
              .getRawMany(); // Используем getRawMany для простых ID

          if (randomQuestionIds.length < 20) {
              throw new Error(`Недостаточно вопросов. Получено: ${randomQuestionIds.length}, требуется: 20`);
          }

          // Затем получаем полные данные вопросов с ответами
          const questions = await queryRunner.manager
              .createQueryBuilder(Question, 'question')
              .leftJoinAndSelect('question.answers', 'answers')
              .where('question.id IN (:...ids)', { 
                  ids: randomQuestionIds.map(q => q.question_id) 
              })
              .getMany();

          // 3. Создаем попытку тестирования
          const attempt = new TestAttempt();
          attempt.user = user;
          attempt.testType = 'exam';
          attempt.status = 'in_progress';
          attempt.totalQuestions = 20;
          attempt.baseQuestionsCount = 20;
          attempt.startedAt = new Date();
          
          const savedAttempt = await queryRunner.manager.save(attempt);

          // 4. Форматируем вопросы
          const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
          const defaultImage = `${baseUrl}/images/default-question.jpg`;

          const formattedQuestions = questions.map(question => ({
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

      // 1. Получаем попытку с блокировкой для избежания конкурентного доступа
      const attempt = await queryRunner.manager.findOne(TestAttempt, {
        where: { 
          id: Number(data.attemptId), 
          user: { id: Number(data.userId) } 
        },
        lock: { mode: "pessimistic_write" }
      });
      
      if (!attempt) {
        throw new Error(`Попытка тестирования ${data.attemptId} не найдена для пользователя ${data.userId}`);
      }

      // 2. Проверяем, что экзамен ещё не завершён
      if (attempt.status !== 'in_progress') {
        throw new Error('Экзамен уже завершён');
      }

      // 3. Получаем вопрос и ответ
      const question = await queryRunner.manager.findOne(Question, {
        where: { id: Number(data.questionId) }
      });
      
      if (!question) {
        throw new Error(`Вопрос ${data.questionId} не найден`);
      }

      const answer = await queryRunner.manager.findOne(Answer, {
        where: { 
          id: Number(data.answerId), 
          question: { id: Number(data.questionId) } 
        }
      });
      
      if (!answer) {
        throw new Error(`Ответ ${data.answerId} для вопроса ${data.questionId} не найден`);
      }

      // 4. Сохраняем ответ пользователя
      const userAnswer = new UserAnswer();
      userAnswer.attempt = attempt;
      userAnswer.question = question;
      userAnswer.answer = answer;
      userAnswer.isCorrect = answer.isCorrect;
      
      await queryRunner.manager.save(userAnswer);

      // 5. Пересчитываем статистику
      const userAnswers = await queryRunner.manager.find(UserAnswer, {
        where: { attempt: { id: attempt.id } }
      });

      const correctAnswers = userAnswers.filter(ua => ua.isCorrect).length;
      const incorrectAnswers = userAnswers.length - correctAnswers;

      // 6. Подготавливаем данные для обновления
      const updateData: Partial<TestAttempt> = {
        correctAnswers,
        incorrectAnswers
      };

      // Добавляем время выполнения, если начальное время валидно
      if (attempt.startedAt && !isNaN(new Date(attempt.startedAt).getTime())) {
        updateData.timeSpentSeconds = Math.floor(
          (new Date().getTime() - new Date(attempt.startedAt).getTime()) / 1000
        );
      }

      // 7. Обновляем попытку только если есть что обновлять
      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(
          TestAttempt, 
          attempt.id, 
          updateData
        );
      }

      await queryRunner.commitTransaction();

      // 8. Возвращаем результат
      return {
        isCorrect: answer.isCorrect,
        correctAnswerId: answer.isCorrect ? null : answer.id,
        currentStats: { 
          correct: correctAnswers, 
          incorrect: incorrectAnswers 
        },
        requiresAdditionalQuestions: incorrectAnswers === 1 || incorrectAnswers === 2
      };
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      console.error('Ошибка обработки ответа:', {
        inputData: data,
        error: error instanceof Error ? error.stack : error
      });
      
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

  private async getAdditionalQuestions(attemptId: number, errorCount: number, userId: number): Promise<AdditionalQuestionsResult> {
    try {
      const additionalCount = errorCount === 1 ? 5 : 10;
      const answeredQuestions = await this.getAnsweredQuestionIds(attemptId);

      const totalQuestions = await AppDataSource.getRepository(Question).count();
      if (totalQuestions - answeredQuestions.length < additionalCount) {
        throw new Error('Недостаточно вопросов для дополнительного тестирования');
      }

      const questions = await AppDataSource.getRepository(Question)
        .createQueryBuilder('question')
        .leftJoinAndSelect('question.answers', 'answers')
        .where('question.id NOT IN (:...answered)', { answered: answeredQuestions })
        .orderBy('RANDOM()')
        .limit(additionalCount)
        .getMany();

      await AppDataSource.getRepository(TestAttempt).update(attemptId, {
        additionalQuestionsAnswered: additionalCount,
        totalQuestions: 20 + additionalCount,
        startedAt: new Date(),
      });

      return {
        status: 'additional_required',
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl,
          topicId: q.topicId,
          isHard: q.isHard,
          createdAt: q.createdAt,
          definedAt: q.definedAt,
          answers: q.answers.map(a => ({
            id: a.id,
            text: a.text
          }))
        }))
      };
    } catch (error) {
      console.error('ExamService.getAdditionalQuestions error:', error);
      throw new Error('Failed to get additional questions: ' + (error instanceof Error ? error.message : 'Unknown error'));
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