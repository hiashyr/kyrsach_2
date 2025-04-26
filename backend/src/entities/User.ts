import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, OneToMany } from "typeorm";
import bcrypt from "bcrypt";
import { PasswordResetToken } from "./PasswordResetTokens";
import { EmailVerificationToken } from "./EmailVerificationToken";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  email!: string;

  // Изменено: Приватное поле для хранения хэша
  private _password_hash!: string;

  @Column({ type: "varchar", length: 255 })
  get password_hash(): string {
    return this._password_hash;
  }

  set password_hash(value: string) {
    // Хешируем пароль автоматически при установке значения
    if (value && !value.startsWith('$2b$')) { // Проверяем, не хэш ли это уже
      this._password_hash = bcrypt.hashSync(value, 10);
    } else {
      this._password_hash = value;
    }
  }

  @Column({ type: "varchar", length: 20, default: "user" })
  role!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "edited_at" })
  updatedAt!: Date;

  @Column({ type: "varchar", length: 255, nullable: true, default: null })
  avatar_url!: string | null;

  @Column({ name: "is_verified", default: false })
  isVerified!: boolean;

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  resetTokens!: PasswordResetToken[];

  @OneToMany(() => EmailVerificationToken, (token) => token.user)
  emailVerificationTokens!: EmailVerificationToken[];

  // Упрощенный метод сравнения паролей
  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this._password_hash);
  }
}