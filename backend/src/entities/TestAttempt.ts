import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { UserAnswer } from './UserAnswer';

@Entity("test_attempts")
export class TestAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  // Исправленная связь с пользователем
  @ManyToOne(() => User, user => user.testAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // Связь с ответами пользователя
  @OneToMany(() => UserAnswer, userAnswer => userAnswer.attempt)
  userAnswers!: UserAnswer[];

  @Column({ 
    name: 'test_type',
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
    name: 'time_spent_seconds',
    type: 'integer', 
    default: 0 
  })
  timeSpentSeconds!: number;

  @Column({ 
    name: 'total_questions',
    type: 'integer',
    default: 0
  })
  totalQuestions!: number;

  @Column({ 
    name: 'correct_answers',
    type: 'integer',
    default: 0
  })
  correctAnswers!: number;

  @Column({ 
    name: 'incorrect_answers',
    type: 'integer',
    default: 0
  })
  incorrectAnswers!: number;

  @Column({ 
    name: 'topic_id',
    type: 'integer',
    nullable: true
  })
  topicId?: number;

  @Column({ 
    name: 'base_questions_count',
    type: 'integer',
    default: 20
  })
  baseQuestionsCount!: number;

  @Column({ 
    name: 'additional_questions_answered',
    type: 'integer', 
    default: 0 
  })
  additionalQuestionsAnswered!: number;

  @Column({ 
    name: 'started_at', 
    type: 'timestamp without time zone', 
    nullable: true 
  })
  startedAt?: Date;

  @Column({ 
    name: 'completed_at',
    type: 'timestamp without time zone',
    nullable: true
  })
  completedAt?: Date;
}