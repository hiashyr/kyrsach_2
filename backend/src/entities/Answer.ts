import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Question } from './Question';

@Entity("answers")
export class Answer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'question_id', type: 'integer' })
  questionId!: number;

  @Column('text')
  text!: string;

  @Column({ name: 'is_correct', type: 'boolean' })
  isCorrect!: boolean;

  @Column({ 
    name: 'created_at', 
    type: 'timestamp without time zone' 
  })
  createdAt!: Date;

  @Column({ 
    name: 'edited_at', 
    type: 'timestamp without time zone', 
    nullable: true 
  })
  editedAt?: Date;

  @ManyToOne(() => Question, question => question.answers)
  @JoinColumn({ name: 'question_id' })
  question!: Question;
}