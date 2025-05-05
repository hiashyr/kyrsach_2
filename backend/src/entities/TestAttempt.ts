import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity("test_attempts") // Явно указываем имя таблицы
export class TestAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, user => user.testAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) // Соответствие имени столбца в БД
  user!: User;

  @Column({ 
    name: 'test_type', // Соответствие имени столбца в БД
    type: 'varchar', 
    length: 20 
  })
  testType!: 'exam' | 'topic' | 'hard';

  @Column({ 
    name: 'status', 
    type: 'varchar', 
    length: 20, 
    default: 'in_progress' 
  })
  status!: 'in_progress' | 'passed' | 'failed';

  @Column({ 
    name: 'time_spent_seconds', // Соответствие имени столбца в БД
    type: 'integer', 
    default: 0 
  })
  timeSpentSeconds!: number;

  @Column({ 
    name: 'total_questions', // Новое поле из структуры таблицы
    type: 'integer',
    default: 0
  })
  totalQuestions!: number;

  @Column({ 
    name: 'correct_answers', // Новое поле из структуры таблицы
    type: 'integer',
    default: 0
  })
  correctAnswers!: number;

  @Column({ 
    name: 'incorrect_answers', // Новое поле из структуры таблицы
    type: 'integer',
    default: 0
  })
  incorrectAnswers!: number;

  @Column({ 
    name: 'topic_id', // Новое поле из структуры таблицы
    type: 'integer',
    nullable: true
  })
  topicId?: number;

  @Column({ 
    name: 'base_questions_count', // Соответствие имени столбца в БД
    type: 'integer' 
  })
  baseQuestionsCount!: number;

  @Column({ 
    name: 'additional_questions_answered', // Соответствие имени столбца в БД
    type: 'integer', 
    default: 0 
  })
  additionalQuestionsAnswered!: number;

  @Column({ 
    name: 'started_at', // Соответствие имени столбца в БД
    type: 'timestamp without time zone',
    default: () => 'CURRENT_TIMESTAMP'
  })
  startedAt!: Date;

  @Column({ 
    name: 'completed_at', // Соответствие имени столбца в БД
    type: 'timestamp without time zone',
    nullable: true
  })
  completedAt?: Date;
}