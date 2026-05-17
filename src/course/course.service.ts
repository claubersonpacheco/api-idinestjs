import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../category/category.entity';
import { MoodleService } from '../moodle/moodle.service';
import { Role } from '../role/role.entity';
import { Setting } from '../setting/setting.entity';
import { User } from '../user/user.entity';
import { CourseEnrollment } from './course-enrollment.entity';
import { Course } from './course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollUserDto } from './dto/enroll-user.dto';
import { PixCallbackDto } from './dto/pix-callback.dto';
import { UpdateEnrollmentPaymentDto } from './dto/update-enrollment-payment.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type PublicEnrollmentPaymentPayload = {
  paymentMethod?: 'pix' | 'boleto' | 'card' | 'bank_transfer' | 'cash_in_person';
  paymentTerm?: 'cash' | 'installments';
  installments?: number;
};

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type PixConfig = {
  key: string;
  merchantName: string;
  merchantCity: string;
  callbackSecret: string | null;
};

type AsaasConfig = {
  apiKey: string;
  baseUrl: string;
  webhookToken: string | null;
};

type AsaasPaymentWebhook = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    billingType?: string;
  };
};

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly moodleService: MoodleService,
  ) {}

  async findAll(): Promise<Array<Course & { enrollmentCount: number }>> {
    const courses = await this.courseRepository.find({ order: { id: 'ASC' } });
    return this.attachEnrollmentCounts(courses);
  }

  async findOne(id: number): Promise<Course & { enrollmentCount: number }> {
    const course = await this.courseRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found.`);
    }
    const [courseWithCount] = await this.attachEnrollmentCounts([course]);
    return courseWithCount;
  }

  async findPublicCourse(id: number): Promise<Course & { enrollmentCount: number }> {
    const course = await this.findOne(id);

    this.ensureCourseHasCapacity(course);

    return course;
  }

  async findPublicCourseBySlug(
    slug: string,
  ): Promise<Course & { enrollmentCount: number }> {
    const course = await this.courseRepository.findOne({
      where: {
        shortname: slug,
      },
    });

    if (!course) {
      throw new NotFoundException(`Public course with slug ${slug} not found.`);
    }

    const [courseWithCount] = await this.attachEnrollmentCounts([course]);
    this.ensureCourseHasCapacity(courseWithCount);
    return courseWithCount;
  }

  async findPublicCourses(): Promise<Array<Course & { enrollmentCount: number }>> {
    const courses = await this.courseRepository.find({
      where: {
        accessType: 'open',
      },
      order: {
        id: 'ASC',
      },
    });

    return this.attachEnrollmentCounts(courses);
  }

  private async attachEnrollmentCounts(
    courses: Course[],
  ): Promise<Array<Course & { enrollmentCount: number }>> {
    if (!courses.length) {
      return [];
    }

    const rows = (await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .select('enrollment.course_id', 'courseId')
      .addSelect('COUNT(enrollment.id)', 'total')
      .where('enrollment.course_id IN (:...courseIds)', {
        courseIds: courses.map((course) => course.id),
      })
      .groupBy('enrollment.course_id')
      .getRawMany()) as Array<{ courseId: number | string; total: string }>;

    const counts = new Map(
      rows.map((row) => [Number(row.courseId), Number(row.total)]),
    );

    return courses.map((course) =>
      Object.assign(course, {
        enrollmentCount: counts.get(course.id) ?? 0,
      }),
    );
  }

  private async findCategoryOrFail(categoryId: number): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id: categoryId });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found.`);
    }
    return category;
  }

  private buildCoursePayload(dto: CreateCourseDto | UpdateCourseDto): Partial<Course> {
    const accessType =
      dto.accessType ??
      (dto.isPublic !== undefined
        ? dto.isPublic === 'true'
          ? 'open'
          : 'private'
        : undefined);
    const pricingType = dto.pricingType;
    const capacityType = dto.capacityType;

    return {
      ...(accessType !== undefined
        ? { accessType, isPublic: accessType === 'open' }
        : {}),
      ...(pricingType !== undefined ? { pricingType } : {}),
      ...(dto.price !== undefined
        ? { price: (pricingType ?? 'paid') === 'paid' ? dto.price.toFixed(2) : null }
        : {}),
      ...(capacityType !== undefined ? { capacityType } : {}),
      ...(dto.capacityLimit !== undefined
        ? {
            capacityLimit:
              (capacityType ?? 'limited') === 'limited' ? dto.capacityLimit : null,
          }
        : {}),
      ...(dto.paymentMethods !== undefined
        ? {
            paymentMethods:
              (pricingType ?? 'paid') === 'paid' && dto.paymentMethods.length
                ? dto.paymentMethods
                : null,
          }
        : {}),
      ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms } : {}),
      ...(dto.maxInstallments !== undefined
        ? {
            maxInstallments:
              dto.paymentTerms === 'installments' || dto.paymentTerms === 'both'
                ? dto.maxInstallments
                : null,
          }
        : {}),
      ...(dto.bankTransferDetails !== undefined
        ? { bankTransferDetails: dto.bankTransferDetails?.trim() || null }
        : {}),
    };
  }

  private validateCourseRules(course: Partial<Course>): void {
    if (course.pricingType === 'paid') {
      const price = Number(course.price ?? 0);

      if (!price || price <= 0) {
        throw new BadRequestException('Informe um valor maior que zero para cursos pagos.');
      }

      if (!course.paymentMethods?.length) {
        throw new BadRequestException('Selecione ao menos uma forma de pagamento.');
      }

      if (
        course.paymentMethods.includes('bank_transfer') &&
        !course.bankTransferDetails?.trim()
      ) {
        throw new BadRequestException('Informe os dados para transferencia bancaria.');
      }
    }

    if (course.capacityType === 'limited' && !course.capacityLimit) {
      throw new BadRequestException('Informe o limite de vagas do curso.');
    }

    if (
      (course.paymentTerms === 'installments' || course.paymentTerms === 'both') &&
      !course.maxInstallments
    ) {
      throw new BadRequestException('Informe o numero maximo de parcelas.');
    }
  }

  private ensureCourseHasCapacity(
    course: Course & { enrollmentCount?: number },
  ): void {
    if (
      course.capacityType === 'limited' &&
      course.capacityLimit !== null &&
      (course.enrollmentCount ?? 0) >= course.capacityLimit
    ) {
      throw new BadRequestException('Este curso nao possui vagas disponiveis.');
    }
  }

  private validatePaymentChoice(
    course: Course,
    payment?: PublicEnrollmentPaymentPayload,
  ): Required<PublicEnrollmentPaymentPayload> {
    if (course.pricingType !== 'paid') {
      return { paymentMethod: 'cash_in_person', paymentTerm: 'cash', installments: 1 };
    }

    if (!payment?.paymentMethod || !course.paymentMethods?.includes(payment.paymentMethod)) {
      throw new BadRequestException('Selecione uma forma de pagamento valida.');
    }

    if (!payment.paymentTerm) {
      throw new BadRequestException('Selecione se o pagamento sera a vista ou a prazo.');
    }

    const normalizedPaymentTerm =
      payment.paymentMethod === 'pix' ? 'cash' : payment.paymentTerm;

    if (
      payment.paymentMethod !== 'pix' &&
      course.paymentTerms !== 'both' &&
      normalizedPaymentTerm !== course.paymentTerms
    ) {
      throw new BadRequestException('Condicao de pagamento indisponivel para este curso.');
    }

    const installments =
      normalizedPaymentTerm === 'installments' ? (payment.installments ?? 1) : 1;

    if (
      normalizedPaymentTerm === 'installments' &&
      course.maxInstallments &&
      installments > course.maxInstallments
    ) {
      throw new BadRequestException(
        `Este curso permite no maximo ${course.maxInstallments} parcelas.`,
      );
    }

    return {
      paymentMethod: payment.paymentMethod,
      paymentTerm: normalizedPaymentTerm,
      installments,
    };
  }

  private async ensureMoodleCategory(category: Category): Promise<number> {
    if (category.mcode) {
      return category.mcode;
    }

    const moodleCategory = await this.moodleService.createCategory({
      name: category.name,
      description: category.description,
    });

    category.mcode = moodleCategory.id;
    await this.categoryRepository.save(category);

    return moodleCategory.id;
  }

  private async getBunnyStorageConfig(): Promise<{
    zoneName: string;
    accessKey: string;
    publicBaseUrl: string;
  }> {
    const [setting] = await this.settingRepository.find({
      order: { id: 'DESC' },
      take: 1,
    });
    const zoneName = setting?.bunnyStorageZoneName?.trim();
    const accessKey = setting?.bunnyStorageAccessKey?.trim();
    const publicBaseUrl = (
      setting?.bunnyStorageCdnDomain ||
      setting?.bunnyStorageBaseUrl ||
      ''
    )
      .trim()
      .replace(/\/+$/, '');

    if (!zoneName || !accessKey || !publicBaseUrl) {
      throw new BadRequestException(
        'Configure bunnyStorageZoneName, bunnyStorageAccessKey e bunnyStorageCdnDomain/baseUrl antes de enviar imagens.',
      );
    }

    return {
      zoneName,
      accessKey,
      publicBaseUrl: /^https?:\/\//.test(publicBaseUrl)
        ? publicBaseUrl
        : `https://${publicBaseUrl}`,
    };
  }

  private getImageExtension(file: UploadedImageFile): string {
    const extensionByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    return extensionByMime[file.mimetype] ?? '';
  }

  private sanitizePathSegment(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  private formatPixField(id: string, value: string): string {
    return `${id}${String(value.length).padStart(2, '0')}${value}`;
  }

  private normalizePixText(value: string, maxLength: number): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 $%*+\-./:]/g, '')
      .trim()
      .slice(0, maxLength)
      .toUpperCase();
  }

  private calculatePixCrc16(payload: string): string {
    let crc = 0xffff;

    for (let index = 0; index < payload.length; index += 1) {
      crc ^= payload.charCodeAt(index) << 8;

      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  private buildPixCopyPaste(params: {
    key: string;
    merchantName: string;
    merchantCity: string;
    amount: string;
    txid: string;
    description: string;
  }): string {
    const merchantAccount = [
      this.formatPixField('00', 'BR.GOV.BCB.PIX'),
      this.formatPixField('01', params.key),
      this.formatPixField('02', this.normalizePixText(params.description, 72)),
    ].join('');

    const additionalData = this.formatPixField('05', params.txid);
    const payload = [
      this.formatPixField('00', '01'),
      this.formatPixField('26', merchantAccount),
      this.formatPixField('52', '0000'),
      this.formatPixField('53', '986'),
      this.formatPixField('54', Number(params.amount).toFixed(2)),
      this.formatPixField('58', 'BR'),
      this.formatPixField('59', this.normalizePixText(params.merchantName, 25)),
      this.formatPixField('60', this.normalizePixText(params.merchantCity, 15)),
      this.formatPixField('62', additionalData),
      '6304',
    ].join('');

    return `${payload}${this.calculatePixCrc16(payload)}`;
  }

  private async getPixConfig(): Promise<PixConfig> {
    const [setting] = await this.settingRepository.find({
      order: { id: 'DESC' },
      take: 1,
    });

    const key = setting?.pixKey?.trim();
    const merchantName = setting?.pixMerchantName?.trim() || setting?.name?.trim();
    const merchantCity = setting?.pixMerchantCity?.trim();

    if (!key || !merchantName || !merchantCity) {
      throw new BadRequestException(
        'Configure pixKey, pixMerchantName e pixMerchantCity antes de receber pagamentos por PIX.',
      );
    }

    return {
      key,
      merchantName,
      merchantCity,
      callbackSecret: setting?.pixCallbackSecret?.trim() || null,
    };
  }

  private async getAsaasConfig(): Promise<AsaasConfig | null> {
    const [setting] = await this.settingRepository.find({
      order: { id: 'DESC' },
      take: 1,
    });

    const apiKey = setting?.asaasApiKey?.trim();

    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      baseUrl: (setting?.asaasBaseUrl?.trim() || 'https://api-sandbox.asaas.com/v3').replace(/\/+$/, ''),
      webhookToken: setting?.asaasWebhookToken?.trim() || null,
    };
  }

  private mapAsaasBillingType(
    paymentMethod: NonNullable<CourseEnrollment['paymentMethod']>,
  ): 'PIX' | 'BOLETO' | 'CREDIT_CARD' | null {
    if (paymentMethod === 'pix') return 'PIX';
    if (paymentMethod === 'boleto') return 'BOLETO';
    if (paymentMethod === 'card') return 'CREDIT_CARD';
    return null;
  }

  private async asaasRequest<T>(
    config: AsaasConfig,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        access_token: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | ({ errors?: Array<{ description?: string }> } & T)
      | null;

    if (!response.ok) {
      const message =
        payload?.errors?.map((error) => error.description).filter(Boolean).join(', ') ||
        response.statusText;
      throw new BadRequestException(`Asaas: ${message}`);
    }

    return payload as T;
  }

  private async createAsaasCharge(
    enrollment: CourseEnrollment,
  ): Promise<CourseEnrollment> {
    const billingType = enrollment.paymentMethod
      ? this.mapAsaasBillingType(enrollment.paymentMethod)
      : null;

    if (!billingType || enrollment.asaasPaymentId) {
      return enrollment;
    }

    const config = await this.getAsaasConfig();

    if (!config) {
      return enrollment;
    }

    const customer = await this.asaasRequest<{ id: string }>(config, '/customers', {
      name: `${enrollment.user.name} ${enrollment.user.lastname || ''}`.trim(),
      email: enrollment.user.email,
      externalReference: `user-${enrollment.user.id}`,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const paymentBody: Record<string, unknown> = {
      customer: customer.id,
      billingType,
      value: Number(enrollment.amountDue ?? 0),
      dueDate: dueDate.toISOString().slice(0, 10),
      description: enrollment.course.fullname,
      externalReference: `enrollment-${enrollment.id}`,
    };

    if ((enrollment.installments ?? 1) > 1) {
      paymentBody.installmentCount = enrollment.installments;
      paymentBody.totalValue = Number(enrollment.amountDue ?? 0);
      delete paymentBody.value;
    }

    const payment = await this.asaasRequest<{
      id: string;
      status?: string;
      invoiceUrl?: string;
      bankSlipUrl?: string;
    }>(config, '/payments', paymentBody);

    enrollment.asaasCustomerId = customer.id;
    enrollment.asaasPaymentId = payment.id;
    enrollment.asaasInvoiceUrl = payment.invoiceUrl || null;
    enrollment.asaasBankSlipUrl = payment.bankSlipUrl || null;
    enrollment.asaasPaymentStatus = payment.status || null;

    return this.enrollmentRepository.save(enrollment);
  }

  private async preparePixCharge(
    enrollment: CourseEnrollment,
  ): Promise<CourseEnrollment> {
    if (enrollment.paymentMethod !== 'pix' || enrollment.status !== 'pending_payment' || enrollment.asaasPaymentId) {
      return enrollment;
    }

    const config = await this.getPixConfig();
    const txid =
      enrollment.pixTxid ||
      `IDI${enrollment.course.id}${enrollment.user.id}${Date.now()}`
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 35);

    enrollment.pixTxid = txid;
    enrollment.pixCopyPaste = this.buildPixCopyPaste({
      key: config.key,
      merchantName: config.merchantName,
      merchantCity: config.merchantCity,
      amount: enrollment.amountDue ?? '0',
      txid,
      description: enrollment.course.fullname,
    });
    enrollment.pixExpiresAt =
      enrollment.pixExpiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.enrollmentRepository.save(enrollment);
  }

  async uploadCourseImage(
    courseId: number,
    file?: UploadedImageFile,
  ): Promise<Course> {
    const course = await this.findOne(courseId);

    if (!file) {
      throw new BadRequestException('Selecione uma imagem para enviar.');
    }

    const extension = this.getImageExtension(file);

    if (!extension) {
      throw new BadRequestException('Envie uma imagem JPG, PNG, WEBP ou GIF.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('A imagem deve ter no maximo 5MB.');
    }

    const config = await this.getBunnyStorageConfig();
    const fileName = `${course.id}-${Date.now()}-${this.sanitizePathSegment(
      course.shortname,
    )}.${extension}`;
    const storagePath = `courses/${fileName}`;
    const uploadUrl = `https://storage.bunnycdn.com/${config.zoneName}/${storagePath}`;
    const uploadBody = new ArrayBuffer(file.buffer.byteLength);
    new Uint8Array(uploadBody).set(file.buffer);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: config.accessKey,
        'Content-Type': file.mimetype,
      },
      body: uploadBody,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(
        `Nao foi possivel enviar a imagem para Bunny Storage. ${body || response.statusText}`,
      );
    }

    course.imageUrl = `${config.publicBaseUrl}/${storagePath}`;
    return this.courseRepository.save(course);
  }

  async create(dto: CreateCourseDto): Promise<Course> {
    const category = await this.findCategoryOrFail(dto.categoryId);
    const moodleCategoryId = await this.ensureMoodleCategory(category);
    const startdate = dto.startdate ? new Date(dto.startdate) : null;
    const enddate = dto.enddate ? new Date(dto.enddate) : null;
    const coursePayload = this.buildCoursePayload(dto);
    const nextCourseRules = {
      accessType: 'private' as const,
      pricingType: 'free' as const,
      currency: 'BRL',
      capacityType: 'unlimited' as const,
      paymentTerms: 'cash' as const,
      ...coursePayload,
    };

    this.validateCourseRules(nextCourseRules);

    const moodleCourse = await this.moodleService.createCourse({
      fullname: dto.fullname.trim(),
      shortname: dto.shortname.trim(),
      categoryId: moodleCategoryId,
      summary: dto.summary?.trim() || null,
      visible: dto.visible?.trim() || null,
      startdate,
      enddate,
    });

    const course = this.courseRepository.create({
      fullname: dto.fullname.trim(),
      shortname: dto.shortname.trim(),
      mcode: String(moodleCourse.id),
      summary: dto.summary?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      visible: dto.visible?.trim() || null,
      startdate,
      enddate,
      category,
      ...nextCourseRules,
    });

    try {
      return await this.courseRepository.save(course);
    } catch (error) {
      await this.moodleService
        .deleteCourse(moodleCourse.id)
        .catch(() => undefined);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id);

    const nextCategory =
      dto.categoryId !== undefined
        ? await this.findCategoryOrFail(dto.categoryId)
        : course.category;
    const moodleCategoryId = await this.ensureMoodleCategory(nextCategory);
    const startdate =
      dto.startdate !== undefined
        ? dto.startdate
          ? new Date(dto.startdate)
          : null
        : undefined;
    const enddate =
      dto.enddate !== undefined
        ? dto.enddate
          ? new Date(dto.enddate)
          : null
        : undefined;
    const coursePayload = this.buildCoursePayload(dto);

    this.validateCourseRules({
      ...course,
      ...coursePayload,
    });

    if (course.mcode) {
      await this.moodleService.updateCourse({
        id: Number(course.mcode),
        ...(dto.fullname !== undefined ? { fullname: dto.fullname.trim() } : {}),
        ...(dto.shortname !== undefined
          ? { shortname: dto.shortname.trim() }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: moodleCategoryId } : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary?.trim() || null }
          : {}),
        ...(dto.visible !== undefined ? { visible: dto.visible?.trim() || null } : {}),
        ...(startdate !== undefined ? { startdate } : {}),
        ...(enddate !== undefined ? { enddate } : {}),
      });
    }

    course.category = nextCategory;

    const merged = this.courseRepository.merge(course, {
      ...(dto.fullname !== undefined ? { fullname: dto.fullname.trim() } : {}),
      ...(dto.shortname !== undefined ? { shortname: dto.shortname.trim() } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary?.trim() || null } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl?.trim() || null } : {}),
      ...(dto.visible !== undefined ? { visible: dto.visible?.trim() || null } : {}),
      ...(startdate !== undefined ? { startdate } : {}),
      ...(enddate !== undefined ? { enddate } : {}),
      ...coursePayload,
    });

    return this.courseRepository.save(merged);
  }

  async remove(id: number): Promise<{ message: string }> {
    const course = await this.findOne(id);
    if (course.mcode) {
      await this.moodleService.deleteCourse(Number(course.mcode));
    }
    await this.courseRepository.remove(course);
    return { message: 'Course deleted successfully.' };
  }

  async findEnrollments(courseId: number): Promise<CourseEnrollment[]> {
    const course = await this.findOne(courseId);
    return this.enrollmentRepository.find({
      where: {
        course: {
          id: course.id,
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async findEnrollmentsByUser(userId: number): Promise<CourseEnrollment[]> {
    return this.enrollmentRepository.find({
      where: {
        user: {
          id: userId,
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async getMoodleLoginUrlForCourse(
    userId: number,
    courseId: number,
  ): Promise<{ url: string }> {
    const course = await this.findOne(courseId);
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found.`);
    }

    if (!course.mcode) {
      throw new BadRequestException('Course does not have a Moodle course id.');
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        course: {
          id: course.id,
        },
        user: {
          id: user.id,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'active') {
      throw new BadRequestException('User is not enrolled in this course.');
    }

    if (enrollment.user.id !== user.id) {
      throw new BadRequestException('Enrollment does not belong to the authenticated user.');
    }

    const url = await this.moodleService.requestLoginUrl({
      moodleUserId: user.moodleUserId,
      username: user.username,
      email: user.email,
      courseId: Number(course.mcode),
    });

    return { url };
  }

  async enrollUser(
    courseId: number,
    dto: EnrollUserDto,
  ): Promise<CourseEnrollment> {
    const course = await this.findOne(courseId);
    const user = await this.userRepository.findOneBy({ id: dto.userId });
    const role = await this.roleRepository.findOneBy({ id: dto.roleId });

    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} not found.`);
    }

    if (!role) {
      throw new NotFoundException(`Role with id ${dto.roleId} not found.`);
    }

    if (!course.mcode) {
      throw new BadRequestException('Course does not have a Moodle course id.');
    }

    if (!user.moodleUserId) {
      throw new BadRequestException('User does not have a Moodle user id.');
    }

    if (!role.moodleRoleId) {
      throw new BadRequestException(
        `Role ${role.name} does not have a Moodle role id configured.`,
      );
    }

    const existing = await this.enrollmentRepository.findOne({
      where: {
        course: { id: course.id },
        user: { id: user.id },
        role: { id: role.id },
      },
    });

    if (existing?.status === 'active') {
      throw new ConflictException('User is already enrolled with this role.');
    }

    const moodleCourseId = Number(course.mcode);
    const moodleCourse = await this.moodleService.findCourseById(moodleCourseId);

    if (!moodleCourse) {
      throw new BadRequestException(
        `Moodle course id ${moodleCourseId} was not found. Update this course so it syncs with Moodle before enrolling users.`,
      );
    }

    await this.moodleService.enrollUser({
      userId: user.moodleUserId,
      courseId: moodleCourseId,
      roleId: role.moodleRoleId,
    });

    const enrollment =
      existing ??
      this.enrollmentRepository.create({
        course,
        user,
        role,
      });
    enrollment.status = 'active';
    enrollment.paymentMethod = null;
    enrollment.paymentTerm = null;
    enrollment.installments = null;
    enrollment.amountDue = null;
    enrollment.paidAt = null;
    enrollment.pixTxid = null;
    enrollment.pixCopyPaste = null;
    enrollment.pixExpiresAt = null;
    enrollment.pixCallbackPayload = null;
    enrollment.asaasCustomerId = null;
    enrollment.asaasPaymentId = null;
    enrollment.asaasInvoiceUrl = null;
    enrollment.asaasBankSlipUrl = null;
    enrollment.asaasPaymentStatus = null;
    enrollment.asaasWebhookPayload = null;

    return this.enrollmentRepository.save(enrollment);
  }

  async enrollPublicUser(
    courseId: number,
    userId: number,
    payment?: PublicEnrollmentPaymentPayload,
  ): Promise<CourseEnrollment> {
    const course = await this.findPublicCourse(courseId);
    return this.enrollPublicCourseUser(course, userId, payment);
  }

  async enrollPublicUserBySlug(
    slug: string,
    userId: number,
    payment?: PublicEnrollmentPaymentPayload,
  ): Promise<CourseEnrollment> {
    const course = await this.findPublicCourseBySlug(slug);
    return this.enrollPublicCourseUser(course, userId, payment);
  }

  private async enrollPublicCourseUser(
    course: Course & { enrollmentCount?: number },
    userId: number,
    payment?: PublicEnrollmentPaymentPayload,
  ): Promise<CourseEnrollment> {
    this.ensureCourseHasCapacity(course);

    const role =
      (await this.roleRepository.findOneBy({ moodleRoleId: 5 })) ??
      (await this.roleRepository.findOneBy({ name: 'student' }));

    if (!role) {
      throw new BadRequestException(
        'Student role is not configured. Create a role with Moodle role id 5 before public enrollments.',
      );
    }

    if (course.pricingType === 'paid') {
      const user = await this.userRepository.findOneBy({ id: userId });

      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found.`);
      }

      const paymentChoice = this.validatePaymentChoice(course, payment);
      const existing = await this.enrollmentRepository.findOne({
        where: {
          course: { id: course.id },
          user: { id: user.id },
          role: { id: role.id },
        },
      });

      if (existing?.status === 'active') {
        return existing;
      }

      const enrollment =
        existing ?? this.enrollmentRepository.create({ course, user, role });
      enrollment.status = 'pending_payment';
      enrollment.paymentMethod = paymentChoice.paymentMethod;
      enrollment.paymentTerm = paymentChoice.paymentTerm;
      enrollment.installments = paymentChoice.installments;
      enrollment.amountDue = course.price;
      enrollment.paidAt = null;
      enrollment.pixTxid = paymentChoice.paymentMethod === 'pix' ? enrollment.pixTxid : null;
      enrollment.pixCopyPaste =
        paymentChoice.paymentMethod === 'pix' ? enrollment.pixCopyPaste : null;
      enrollment.pixExpiresAt =
        paymentChoice.paymentMethod === 'pix' ? enrollment.pixExpiresAt : null;
      enrollment.pixCallbackPayload = null;
      enrollment.asaasCustomerId = null;
      enrollment.asaasPaymentId = null;
      enrollment.asaasInvoiceUrl = null;
      enrollment.asaasBankSlipUrl = null;
      enrollment.asaasPaymentStatus = null;
      enrollment.asaasWebhookPayload = null;

      const saved = await this.enrollmentRepository.save(enrollment);
      const asaasEnrollment = await this.createAsaasCharge(saved);
      return this.preparePixCharge(asaasEnrollment);
    }

    return this.enrollUser(course.id, {
      userId,
      roleId: role.id,
    });
  }

  async unenrollUser(
    courseId: number,
    enrollmentId: number,
  ): Promise<{ message: string }> {
    await this.findOne(courseId);
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: enrollmentId,
        course: {
          id: courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with id ${enrollmentId} not found.`,
      );
    }

    if (
      enrollment.user.moodleUserId &&
      enrollment.course.mcode &&
      enrollment.role.moodleRoleId
    ) {
      await this.moodleService.unenrollUser({
        userId: enrollment.user.moodleUserId,
        courseId: Number(enrollment.course.mcode),
        roleId: enrollment.role.moodleRoleId,
      });
    }

    await this.enrollmentRepository.remove(enrollment);

    return { message: 'User unenrolled successfully.' };
  }

  async approveEnrollmentPayment(
    courseId: number,
    enrollmentId: number,
  ): Promise<CourseEnrollment> {
    await this.findOne(courseId);
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: enrollmentId,
        course: { id: courseId },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${enrollmentId} not found.`);
    }

    if (enrollment.status === 'active') {
      return enrollment;
    }

    await this.enrollUser(courseId, {
      userId: enrollment.user.id,
      roleId: enrollment.role.id,
    });

    const updated = await this.enrollmentRepository.findOneBy({ id: enrollmentId });

    if (!updated) {
      throw new NotFoundException(`Enrollment with id ${enrollmentId} not found.`);
    }

    updated.paymentMethod = enrollment.paymentMethod;
    updated.paymentTerm = enrollment.paymentTerm;
    updated.installments = enrollment.installments;
    updated.amountDue = enrollment.amountDue;
    updated.paidAt = new Date();
    updated.asaasCustomerId = enrollment.asaasCustomerId;
    updated.asaasPaymentId = enrollment.asaasPaymentId;
    updated.asaasInvoiceUrl = enrollment.asaasInvoiceUrl;
    updated.asaasBankSlipUrl = enrollment.asaasBankSlipUrl;
    updated.asaasPaymentStatus = enrollment.asaasPaymentStatus;
    updated.asaasWebhookPayload = enrollment.asaasWebhookPayload;

    return this.enrollmentRepository.save(updated);
  }

  async updateEnrollmentPayment(
    courseId: number,
    enrollmentId: number,
    dto: UpdateEnrollmentPaymentDto,
  ): Promise<CourseEnrollment> {
    await this.findOne(courseId);
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: enrollmentId,
        course: { id: courseId },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${enrollmentId} not found.`);
    }

    if (dto.paymentStatus === 'paid') {
      if (!enrollment.paymentMethod) {
        enrollment.paymentMethod = 'cash_in_person';
      }

      enrollment.status = 'active';
      enrollment.amountDue = enrollment.amountDue ?? enrollment.course.price ?? null;
      enrollment.paymentTerm = enrollment.paymentTerm ?? 'cash';
      enrollment.installments = enrollment.installments ?? 1;
      enrollment.paidAt = new Date();

      return this.enrollmentRepository.save(enrollment);
    }

    if (dto.paymentStatus === 'pending_payment') {
      if (enrollment.course.pricingType !== 'paid') {
        throw new BadRequestException(
          'Cursos gratuitos nao podem ficar com pagamento pendente.',
        );
      }

      enrollment.status = 'pending_payment';
      enrollment.paymentMethod = enrollment.paymentMethod ?? 'cash_in_person';
      enrollment.paymentTerm = enrollment.paymentTerm ?? 'cash';
      enrollment.installments = enrollment.installments ?? 1;
      enrollment.amountDue = enrollment.amountDue ?? enrollment.course.price;
      enrollment.paidAt = null;

      return this.enrollmentRepository.save(enrollment);
    }

    enrollment.status = 'active';
    enrollment.paymentMethod = null;
    enrollment.paymentTerm = null;
    enrollment.installments = null;
    enrollment.amountDue = null;
    enrollment.paidAt = null;
    enrollment.pixTxid = null;
    enrollment.pixCopyPaste = null;
    enrollment.pixExpiresAt = null;
    enrollment.pixCallbackPayload = null;

    return this.enrollmentRepository.save(enrollment);
  }

  async confirmPixPayment(dto: PixCallbackDto): Promise<CourseEnrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        pixTxid: dto.txid,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`PIX txid ${dto.txid} not found.`);
    }

    const config = await this.getPixConfig();

    if (config.callbackSecret && dto.secret !== config.callbackSecret) {
      throw new BadRequestException('Callback PIX invalido.');
    }

    const paidStatuses = new Set([
      'paid',
      'approved',
      'confirmed',
      'concluida',
      'concluido',
      'completed',
    ]);
    const status = dto.status?.trim().toLowerCase() || 'paid';

    enrollment.pixCallbackPayload = dto as unknown as Record<string, unknown>;
    await this.enrollmentRepository.save(enrollment);

    if (!paidStatuses.has(status)) {
      return enrollment;
    }

    if (dto.amount !== undefined && Number(dto.amount) < Number(enrollment.amountDue ?? 0)) {
      throw new BadRequestException('Valor PIX recebido menor que o valor do curso.');
    }

    return this.approveEnrollmentPayment(enrollment.course.id, enrollment.id);
  }

  async handleAsaasWebhook(
    dto: AsaasPaymentWebhook,
    accessToken?: string,
  ): Promise<CourseEnrollment | { message: string }> {
    const config = await this.getAsaasConfig();

    if (config?.webhookToken && accessToken !== config.webhookToken) {
      throw new BadRequestException('Webhook Asaas invalido.');
    }

    const paymentId = dto.payment?.id;

    if (!paymentId) {
      return { message: 'Webhook Asaas ignorado sem payment id.' };
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        asaasPaymentId: paymentId,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Asaas payment ${paymentId} not found.`);
    }

    enrollment.asaasPaymentStatus = dto.payment?.status || dto.event || null;
    enrollment.asaasWebhookPayload = dto as unknown as Record<string, unknown>;
    await this.enrollmentRepository.save(enrollment);

    const paidEvents = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

    if (!dto.event || !paidEvents.has(dto.event)) {
      return enrollment;
    }

    if (
      dto.payment?.value !== undefined &&
      Number(dto.payment.value) < Number(enrollment.amountDue ?? 0)
    ) {
      throw new BadRequestException('Valor Asaas recebido menor que o valor do curso.');
    }

    return this.approveEnrollmentPayment(enrollment.course.id, enrollment.id);
  }
}
