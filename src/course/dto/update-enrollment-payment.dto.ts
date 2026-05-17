import { IsIn } from 'class-validator';

export class UpdateEnrollmentPaymentDto {
  @IsIn(['pending_payment', 'paid', 'manual'])
  paymentStatus: 'pending_payment' | 'paid' | 'manual';
}
