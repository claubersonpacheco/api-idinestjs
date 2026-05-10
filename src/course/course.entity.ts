import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../category/category.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  fullname: string;

  @Column({ type: 'varchar', length: 80 })
  shortname: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mcode: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 512, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 1, nullable: true })
  visible: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'access_type', type: 'varchar', length: 20, default: 'private' })
  accessType: 'open' | 'private';

  @Column({ name: 'pricing_type', type: 'varchar', length: 20, default: 'free' })
  pricingType: 'free' | 'paid';

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  @Column({ name: 'capacity_type', type: 'varchar', length: 20, default: 'unlimited' })
  capacityType: 'unlimited' | 'limited';

  @Column({ name: 'capacity_limit', type: 'int', nullable: true })
  capacityLimit: number | null;

  @Column({ name: 'payment_methods', type: 'simple-array', nullable: true })
  paymentMethods: string[] | null;

  @Column({ name: 'payment_terms', type: 'varchar', length: 20, default: 'cash' })
  paymentTerms: 'cash' | 'installments' | 'both';

  @Column({ name: 'max_installments', type: 'int', nullable: true })
  maxInstallments: number | null;

  @Column({ name: 'bank_transfer_details', type: 'text', nullable: true })
  bankTransferDetails: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'startdate' })
  startdate: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'enddate' })
  enddate: Date | null;

  @ManyToOne(() => Category, { eager: true, nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
