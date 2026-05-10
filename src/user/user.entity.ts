import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../role/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  username: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastname: string | null;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 1, default: '0' })
  suspended: string;

  @Column({ name: 'moodle_user_id', type: 'int', nullable: true })
  moodleUserId: number | null;

  @ManyToOne(() => Role, (role) => role.users, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  @Column({ length: 255, select: false })
  password: string;

  @Column({ name: 'reset_password_token', type: 'varchar', length: 255, nullable: true })
  resetPasswordToken: string | null;

  @Column({ name: 'reset_password_expires', type: 'timestamp', nullable: true })
  resetPasswordExpires: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
