import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { Course } from './course.entity';

@Entity('course_enrollments')
@Unique('UQ_course_enrollments_course_user_role', ['course', 'user', 'role'])
export class CourseEnrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Course, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, { eager: true, nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: 'active' | 'pending_payment';

  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true })
  paymentMethod: 'pix' | 'boleto' | 'card' | 'bank_transfer' | 'cash_in_person' | null;

  @Column({ name: 'payment_term', type: 'varchar', length: 20, nullable: true })
  paymentTerm: 'cash' | 'installments' | null;

  @Column({ type: 'int', nullable: true })
  installments: number | null;

  @Column({ name: 'amount_due', type: 'numeric', precision: 10, scale: 2, nullable: true })
  amountDue: string | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'pix_txid', type: 'varchar', length: 35, nullable: true })
  pixTxid: string | null;

  @Column({ name: 'pix_copy_paste', type: 'text', nullable: true })
  pixCopyPaste: string | null;

  @Column({ name: 'pix_expires_at', type: 'timestamp', nullable: true })
  pixExpiresAt: Date | null;

  @Column({ name: 'pix_callback_payload', type: 'jsonb', nullable: true })
  pixCallbackPayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
