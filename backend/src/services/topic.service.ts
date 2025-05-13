import { AppDataSource } from '../config/data-source';
import { TopicProgress } from '../entities/TopicProgress';
import { TestAttempt } from '../entities/TestAttempt';
import { User } from '../entities/User';
import { Topic } from '../entities/Topic';
import { Question } from '../entities/Question';
import { Answer } from '../entities/Answer';
import { UserAnswer } from '../entities/UserAnswer';

interface RawTopicWithProgress {
  id: number;
  name: string;
  description: string;
  questions_count: number;
  status: string;
  correct_answers: number | null;
  questions_answered: number | null;
  questions_total: number | null;
  last_attempt_date: Date | null;
}

interface TopicWithProgress {
  id: number;
  name: string;
  description: string;
  questions_count: number;
  status: string;
  correct_answers: number;
  questions_answered: number;
  questions_total: number;
  last_attempt_date: Date | null;
}

class TopicService {
  private topicProgressRepo = AppDataSource.getRepository(TopicProgress);
  private attemptRepo = AppDataSource.getRepository(TestAttempt);
  private topicRepo = AppDataSource.getRepository(Topic);
  private questionRepo = AppDataSource.getRepository(Question);
  private answerRepo = AppDataSource.getRepository(Answer);
  private userAnswerRepo = AppDataSource.getRepository(UserAnswer);

  async getTopicsWithProgress(userId: number): Promise<TopicWithProgress[]> {
    const result = await AppDataSource.query<RawTopicWithProgress[]>(`
      SELECT 
        t.id,
        t.name,
        t.description,
        t.questions_count,
        COALESCE(tp.status, 'not_started') as status,
        tp.correct_answers,
        tp.questions_answered,
        tp.questions_total,
        a.completed_at as last_attempt_date
      FROM topics t
      LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = $1
      LEFT JOIN test_attempts a ON a.id = tp.last_attempt_id
      ORDER BY t.id
    `, [userId]);

    return result.map((topic: RawTopicWithProgress) => ({
      ...topic,
      correct_answers: topic.correct_answers || 0,
      questions_answered: topic.questions_answered || 0,
      questions_total: topic.questions_total || topic.questions_count
    }));
  }

  private async ensureTopicExists(topicId: number): Promise<void> {
    const topic = await this.topicRepo.findOneBy({ id: topicId });
    if (!topic) {
      throw new Error(`Topic with ID ${topicId} not found`);
    }
  }

  async initTopicProgress(userId: number, topicId: number): Promise<TopicProgress> {
    await this.ensureTopicExists(topicId);
    
    const exists = await this.topicProgressRepo.findOne({
      where: { user: { id: userId }, topicId }
    });

    if (!exists) {
      const progress = new TopicProgress();
      progress.user = { id: userId } as User;
      progress.topicId = topicId;
      progress.status = "not_started";
      progress.questionsTotal = await this.getTopicQuestionsCount(topicId);
      progress.questionsAnswered = 0;
      progress.correctAnswers = 0;
      
      return this.topicProgressRepo.save(progress);
    }
    return exists;
  }

  private async getTopicQuestionsCount(topicId: number): Promise<number> {
    return this.questionRepo.count({ where: { topicId } });
  }

  async getTopicQuestions(topicId: number): Promise<Question[]> {
    return this.questionRepo.find({
      where: { topicId },
      relations: ['answers'],
      take: 20
    });
  }

  async startTopicTest(userId: number, topicId: number) {
    const topic = await this.topicRepo.findOneBy({ id: topicId });
    if (!topic) throw new Error('Тема не найдена');

    const progress = await this.initTopicProgress(userId, topicId);
    const questions = await this.getTopicQuestions(topicId);

    if (questions.length === 0) {
      throw new Error('В этой теме пока нет вопросов');
    }

    const attempt = new TestAttempt();
    attempt.user = { id: userId } as User;
    attempt.testType = 'topic';
    attempt.topicId = topicId;
    attempt.status = 'in_progress';
    attempt.totalQuestions = questions.length;
    attempt.baseQuestionsCount = questions.length;
    attempt.startedAt = new Date();
    
    const savedAttempt = await this.attemptRepo.save(attempt);

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const defaultImage = `${baseUrl}/images/default-question.jpg`;

    console.log('Created attempt with ID:', savedAttempt.id);
    return {
      attemptId: savedAttempt.id,
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl ? `${baseUrl}/uploads/questions/${q.imageUrl}` : defaultImage,
        answers: q.answers.map(a => ({ id: a.id, text: a.text }))
      })),
      topicName: topic.name
    };
  }

  async getAttempt(topicId: number, attemptId: number, userId: number) {
      const attemptExists = await this.attemptRepo.exist({
        where: { 
          id: attemptId,
          user: { id: userId },
          topicId 
        }
      });
      
      if (!attemptExists) {
        throw new Error('Попытка тестирования не найдена');
      }
    // Дополнительная проверка параметров
    if (isNaN(topicId) || isNaN(attemptId) || isNaN(userId)) {
      throw new Error('Invalid parameters');
    }

    const attempt = await this.attemptRepo.findOne({
      where: { 
        id: attemptId, 
        user: { id: userId }, 
        topicId 
      },
      relations: ['userAnswers']
    });

    if (!attempt) {
      throw new Error(`Attempt not found for ID: ${attemptId}`);
    }

    const questions = await this.getTopicQuestions(topicId);
    const topic = await this.topicRepo.findOneBy({ id: topicId });

    return {
      attemptId: attempt.id,
      topicId,
      topicName: topic?.name || '',
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl ? 
          `${process.env.BASE_URL}/uploads/questions/${q.imageUrl}` : 
          null,
        answers: q.answers.map(a => ({ id: a.id, text: a.text }))
      })),
      progress: {
        answered: attempt.userAnswers.length,
        total: attempt.totalQuestions
      }
    };
  }

  async submitAnswer(
    topicId: number,
    attemptId: number,
    questionId: number,
    answerId: number,
    userId: number
  ) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId, user: { id: userId }, topicId }
    });
    if (!attempt) throw new Error('Attempt not found');

    const answer = await this.answerRepo.findOne({
      where: { id: answerId, question: { id: questionId, topicId } },
      relations: ['question']
    });
    if (!answer) throw new Error('Invalid answer');

    const userAnswer = new UserAnswer();
    userAnswer.attempt = attempt;
    userAnswer.question = answer.question;
    userAnswer.answer = answer;
    userAnswer.isCorrect = answer.isCorrect;
    
    await this.userAnswerRepo.save(userAnswer);

    const updateConditions = { user: { id: userId }, topicId };

    if (userAnswer.isCorrect) {
      await this.topicProgressRepo.increment(
        updateConditions,
        'correctAnswers',
        1
      );
    }

    await this.topicProgressRepo.increment(
      updateConditions,
      'questionsAnswered',
      1
    );

    return { success: true, isCorrect: userAnswer.isCorrect };
  }
}

export default new TopicService();