import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIsBlockedColumnManual implements MigrationInterface {
    public async up(): Promise<void> {
      // Столбец уже удален вручную через SQL
    }
    public async down(): Promise<void> {}
  }