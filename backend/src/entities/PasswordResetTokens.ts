import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";

@Entity("password_reset_tokens")
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  token!: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt!: Date;

  @Column({ name: "is_used", type: "boolean", default: false })
  isUsed!: boolean;

  @ManyToOne(() => User, (user) => user.resetTokens)
  @JoinColumn({ name: "user_id" })
  user!: User;
}