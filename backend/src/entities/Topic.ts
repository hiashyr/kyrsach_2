import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Question } from "./Question";

@Entity("topics")
export class Topic {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: "varchar",
    length: 50,
    nullable: false
  })
  name!: string;

  @Column({
    type: "text",
    nullable: true
  })
  description!: string | null;

  @Column({
    name: "questions_count",
    type: "integer",
    default: 0
  })
  questionsCount!: number;

  @Column({
    name: "created_at",
    type: "timestamp"
  })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamp",
    nullable: true
  })
  updatedAt!: Date | null;

  @OneToMany(() => Question, question => question.topic)
  questions!: Question[];
}