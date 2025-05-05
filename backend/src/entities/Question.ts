import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Answer } from './Answer';

@Entity("questions")
export class Question {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  text!: string;

  @Column({ 
    name: 'image_url', 
    type: 'varchar', 
    length: 255, 
    nullable: true 
  })
  imageUrl!: string | null; // Явно указываем тип string и допустимость null

  @Column({ name: 'topic_id', type: 'integer' })
  topicId!: number;

  @Column({ name: 'is_hard', type: 'boolean' })
  isHard!: boolean;

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
  definedAt?: Date;

  @OneToMany(() => Answer, answer => answer.question)
  answers!: Answer[];
}