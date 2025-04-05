import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, OneToMany } from "typeorm";
import bcrypt from "bcrypt";
import { PasswordResetToken } from "./PasswordResetTokens"; // Не забудьте добавить этот импорт

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  password_hash!: string;

  @Column({ type: "varchar", length: 20, default: "user" })
  role!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "edited_at" })
  updatedAt!: Date;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  avatar_url!: string | null;

  // Добавляем связь с токенами сброса пароля
  @OneToMany(() => PasswordResetToken, (token) => token.user)
  resetTokens!: PasswordResetToken[];

  // Автоматическое хеширование пароля перед сохранением
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password_hash) {
      this.password_hash = await bcrypt.hash(this.password_hash, 10);
    }
  }

  // Метод для проверки пароля
  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }
}