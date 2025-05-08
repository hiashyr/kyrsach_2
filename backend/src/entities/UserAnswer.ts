import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, JoinColumn } from 'typeorm';
import { TestAttempt } from './TestAttempt';
import { Question } from './Question';
import { Answer } from './Answer';

@Entity('user_answers')
export class UserAnswer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => TestAttempt, attempt => attempt.userAnswers)
  @JoinColumn({ name: 'attempt_id' }) // Явно указываем имя столбца
  attempt!: TestAttempt;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'question_id' }) // Явно указываем имя столбца
  question!: Question;

  @ManyToOne(() => Answer)
  @JoinColumn({ name: 'answer_id' }) // Явно указываем имя столбца
  answer!: Answer;

  @Column({ name: 'is_correct', type: 'boolean' })
  isCorrect!: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}