import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAvatarColumn implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN avatar_url
        `);
    }
}