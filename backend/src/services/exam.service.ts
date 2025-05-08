import { AppDataSource } from '../config/data-source';
import { TestAttempt } from '../entities/TestAttempt';
import { Question } from '../entities/Question';
import { Answer } from '../entities/Answer';
import { UserAnswer } from '../entities/UserAnswer';
import { In } from 'typeorm';
import { User } from '../entities/User';

interface AnswerSubmission {
  userId: number;
  attemptId: number;
  questionId: number;
  answerId: number;
}

interface ExamStartResult {
  attemptId: number;
  questions: Array<Omit<Question, 'answers'> & {
    answers: Array<Pick<Answer, 'id' | 'text'>>
  }>;
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

class ExamService {
  async startExam(userId: number): Promise<ExamStartResult> {
    try {
      // Получаем репозиторий вопросов
      const questionRepository = AppDataSource.getRepository(Question);
      
      // Получаем случайные ID вопросов
      const randomQuestions = await questionRepository
        .createQueryBuilder('question')
        .select('question.id')
        .orderBy('RANDOM()')
        .limit(20)
        .getMany();
  
      if (randomQuestions.length < 20) {
        throw new Error(`Недостаточно вопросов. Получено: ${randomQuestions.length}, требуется: 20`);
      }
  
      // Получаем полные данные вопросов с ответами
      const questions = await questionRepository
        .createQueryBuilder('question')
        .leftJoinAndSelect('question.answers', 'answers')
        .where('question.id IN (:...ids)', { ids: randomQuestions.map(q => q.id) })
        .getMany();
  
      // Получаем пользователя и проверяем его существование
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOneBy({ id: userId });
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
  
      // Создаем и сохраняем попытку
      const attempt = new TestAttempt();
      attempt.user = user;
      attempt.testType = 'exam';
      attempt.status = 'in_progress';
      attempt.totalQuestions = 20;
      attempt.correctAnswers = 0;
      attempt.incorrectAnswers = 0;
      attempt.baseQuestionsCount = 20;
      attempt.additionalQuestionsAnswered = 0;
      attempt.startedAt = new Date();
      
      const savedAttempt = await AppDataSource.getRepository(TestAttempt).save(attempt);
  
      // Типизированный маппинг вопросов
      const formattedQuestions = questions.map((q: Question) => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        topicId: q.topicId,
        isHard: q.isHard,
        createdAt: q.createdAt,
        definedAt: q.definedAt,
        answers: q.answers.map((a: Answer) => ({
          id: a.id,
          text: a.text
        }))
      }));
  
      return {
        attemptId: savedAttempt.id,
        questions: formattedQuestions
      };
    } catch (error) {
      console.error('ExamService.startExam error:', error);
      throw new Error('Failed to start exam: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
  async processAnswer(data: AnswerSubmission): Promise<AnswerResult> {
    const { userId, attemptId, questionId, answerId } = data;
    const attemptRepo = AppDataSource.getRepository(TestAttempt);
    const answerRepo = AppDataSource.getRepository(Answer);
    const userAnswerRepo = AppDataSource.getRepository(UserAnswer);
  
    try {
      // 1. Находим попытку тестирования
      const attempt = await attemptRepo.findOne({
        where: { id: attemptId, user: { id: userId } },
      });
  
      if (!attempt) throw new Error('Attempt not found');
  
      // 2. Рассчитываем время, затраченное на вопрос
      const timeSpent = attempt.startedAt 
        ? Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000)
        : 0;
  
      // 3. Находим ответ и проверяем его корректность
      const answer = await answerRepo.findOne({
        where: { id: answerId, question: { id: questionId } },
      });
  
      if (!answer) throw new Error('Answer not found');
  
      const isCorrect = answer.isCorrect;
  
      // 4. Сохраняем ответ пользователя
      const userAnswer = new UserAnswer();
      userAnswer.attempt = attempt;
      userAnswer.question = { id: questionId } as Question;
      userAnswer.answer = { id: answerId } as Answer;
      userAnswer.isCorrect = isCorrect;
      await userAnswerRepo.save(userAnswer);
  
      // 5. Обновляем статистику попытки
      const updateData: Partial<TestAttempt> = {
        timeSpentSeconds: attempt.timeSpentSeconds + timeSpent,
        startedAt: new Date(),
      };
  
      if (isCorrect) {
        updateData.correctAnswers = (attempt.correctAnswers || 0) + 1;
      } else {
        updateData.incorrectAnswers = (attempt.incorrectAnswers || 0) + 1;
      }
  
      // Явное обновление попытки
      await attemptRepo.update(
        { id: attemptId },
        updateData
      );
  
      // 6. Получаем обновленную попытку
      const updatedAttempt = await attemptRepo.findOneBy({ id: attemptId });
      if (!updatedAttempt) throw new Error('Failed to update attempt');
  
      // 7. Проверяем, нужны ли дополнительные вопросы
      const requiresAdditional = 
        updatedAttempt.incorrectAnswers === 1 || 
        updatedAttempt.incorrectAnswers === 2;
  
      return {
        isCorrect,
        correctAnswerId: isCorrect ? null : answer.id,
        currentStats: {
          correct: updatedAttempt.correctAnswers,
          incorrect: updatedAttempt.incorrectAnswers,
        },
        requiresAdditionalQuestions: requiresAdditional,
      };
    } catch (error) {
      console.error('ExamService.processAnswer error:', error);
      throw new Error('Failed to process answer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async completeExam(attempt: TestAttempt): Promise<ExamResults | AdditionalQuestionsResult> {
    try {
      const errorCount = attempt.incorrectAnswers;
      
      if (errorCount >= 3) {
        await AppDataSource.getRepository(TestAttempt).update(attempt.id, {
          status: 'failed',
          completedAt: new Date()
        });
        return this.getExamResults(attempt.id, attempt.user.id);
      }

      if (errorCount > 0 && attempt.additionalQuestionsAnswered === 0) {
        const result = await this.getAdditionalQuestions(attempt.id, errorCount, attempt.user.id);
        return {
          status: 'additional_required',
          questions: result.questions
        };
      }

      await AppDataSource.getRepository(TestAttempt).update(attempt.id, {
        status: 'passed',
        completedAt: new Date()
      });

      return this.getExamResults(attempt.id, attempt.user.id);
    } catch (error) {
      console.error('ExamService.completeExam error:', error);
      throw new Error('Failed to complete exam: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
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

    const questionIds = userAnswers.map(ua => ua.question.id);
    const correctAnswers = await AppDataSource.getRepository(Answer)
      .find({
        where: { 
          question: { id: In(questionIds) },
          isCorrect: true 
        },
        relations: ['question']
      });

    const correctAnswersMap = new Map(
      correctAnswers.map(ca => [ca.question.id, ca])
    );

    return userAnswers.map((answer, index) => {
      const correctAnswer = correctAnswersMap.get(answer.question.id);
      const timeSpent = index > 0 
        ? Math.floor((answer.createdAt.getTime() - userAnswers[index - 1].createdAt.getTime()) / 1000)
        : 0;

      return {
        questionId: answer.question.id,
        questionText: answer.question.text,
        userAnswerId: answer.answer.id,
        userAnswerText: answer.answer.text,
        isCorrect: answer.isCorrect,
        correctAnswerId: correctAnswer?.id,
        correctAnswerText: correctAnswer?.text,
        timeSpent,
      };
    });
  }
}

export default new ExamService();