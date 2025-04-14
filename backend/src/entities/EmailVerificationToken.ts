import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";

@Entity("email_verification_tokens")
export class EmailVerificationToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  token!: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt!: Date;

  @Column({ name: "created_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.emailVerificationTokens)
  @JoinColumn({ name: "user_id" })
  user!: User;
}