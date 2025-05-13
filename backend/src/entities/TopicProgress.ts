import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";
import { TestAttempt } from "./TestAttempt";

@Entity("topic_progress")
export class TopicProgress {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => User, user => user.topicProgress)
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ name: "topic_id" })
    topicId!: number;

    @Column({
        type: "enum",
        enum: ["not_started", "in_progress", "passed", "failed"],
        default: "not_started"
    })
    status!: string;

    @ManyToOne(() => TestAttempt)
    @JoinColumn({ name: "last_attempt_id" })
    lastAttempt?: TestAttempt;

    @Column({ name: "questions_total" })
    questionsTotal!: number;

    @Column({ name: "questions_answered" })
    questionsAnswered!: number;

    @Column({ name: "correct_answers" })
    correctAnswers!: number;

    @Column({ name: "created_at" })
    createdAt!: Date;

    @Column({ name: "updated_at" })
    updatedAt!: Date;
}