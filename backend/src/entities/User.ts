import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number; // Добавляем "!" чтобы указать, что свойство будет инициализировано TypeORM

  @Column({ type: "varchar", length: 100, unique: true })
  email!: string; // То же самое для остальных полей

  @Column({ type: "varchar", length: 255 })
  password_hash!: string;

  @Column({ type: "varchar", length: 20, default: "user" })
  role!: string;

  @Column({ type: "boolean", default: false })
  is_blocked!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "edited_at" })
  updatedAt!: Date;

  // Либо можно добавить конструктор:
  constructor() {
    this.id = 0;
    this.email = "";
    this.password_hash = "";
    this.role = "user";
    this.is_blocked = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}