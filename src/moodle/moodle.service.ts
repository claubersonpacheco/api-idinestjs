import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../setting/setting.entity';

type MoodleUserPayload = {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  email: string;
};

type MoodleCreatedUser = {
  id: number;
  username: string;
};

type MoodleCreatedCategory = {
  id: number;
  name: string;
};

type MoodleCreatedCourse = {
  id: number;
  shortname: string;
};

type MoodleCourse = {
  id: number;
  shortname: string;
  fullname: string;
};

type MoodleUser = {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email: string;
};

type MoodleUploadResponseFile = {
  itemid?: number;
  fileurl?: string;
  filename?: string;
};

type MoodleLoginUrlResponse = {
  loginurl: string;
};

type MoodleException = {
  exception?: string;
  errorcode?: string;
  message?: string;
  debuginfo?: string;
};

type MoodleResponse<T> = {
  payload: T | MoodleException | null;
  rawBody: string;
};

const MOODLE_PASSWORD_MESSAGE =
  'A senha nao atende aos requisitos do Moodle. Use pelo menos 8 caracteres, com uma letra maiuscula, uma letra minuscula, um numero e um caractere especial.';

@Injectable()
export class MoodleService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  private async getMoodleConfig(): Promise<{
    endpoint: string;
    baseUrl: string;
    token: string;
  }> {
    const [setting] = await this.settingRepository.find({
      order: {
        id: 'DESC',
      },
      take: 1,
    });

    if (!setting?.moodleUrl || !setting.moodleToken) {
      throw new BadRequestException(
        'Moodle URL and token must be configured before creating users.',
      );
    }

    const moodleUrl = this.normalizeMoodleUrl(setting.moodleUrl);
    const baseUrl = this.getMoodleBaseUrl(moodleUrl);
    const endpoint = `${baseUrl}/webservice/rest/server.php`;

    return {
      baseUrl,
      endpoint,
      token: setting.moodleToken,
    };
  }

  private normalizeMoodleUrl(rawUrl: string): string {
    const normalizedUrl = rawUrl.trim().replace(/[?&]+$/, '');

    if (normalizedUrl.startsWith('http://localhost')) {
      return normalizedUrl;
    }

    if (normalizedUrl.startsWith('http://127.0.0.1')) {
      return normalizedUrl;
    }

    const secureUrl = normalizedUrl.replace(/^http:\/\//, 'https://');

    try {
      new URL(secureUrl);
    } catch {
      throw new BadRequestException(
        'Moodle URL is invalid. Check the settings and make sure the URL and token fields are not swapped.',
      );
    }

    return secureUrl;
  }

  private getMoodleBaseUrl(normalizedUrl: string): string {
    const serverPath = '/webservice/rest/server.php';
    const serverPathIndex = normalizedUrl.indexOf(serverPath);

    if (serverPathIndex >= 0) {
      return normalizedUrl.slice(0, serverPathIndex).replace(/\/+$/, '');
    }

    return normalizedUrl.replace(/\/+$/, '');
  }

  private formatMoodleError(
    wsFunction: string,
    payload: MoodleException,
  ): string {
    const details = [payload.message, payload.debuginfo]
      .filter(Boolean)
      .join(' - ');
    const normalizedDetails = details.toLowerCase();

    if (
      wsFunction === 'core_user_create_users' &&
      normalizedDetails.includes('password')
    ) {
      return MOODLE_PASSWORD_MESSAGE;
    }

    return `${wsFunction}: ${details || 'Moodle returned an error.'}`;
  }

  private async callMoodle<T>(
    wsFunction: string,
    params: URLSearchParams,
  ): Promise<T> {
    const config = await this.getMoodleConfig();
    params.set('wstoken', config.token);
    params.set('wsfunction', wsFunction);
    params.set('moodlewsrestformat', 'json');

    let response: Response;

    try {
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } catch (error) {
      throw new BadRequestException(
        `Could not connect to Moodle. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const rawBody = await response.text();
    const payload = this.parseMoodleResponse<T>(rawBody);

    if (!response.ok) {
      throw new BadRequestException(
        `Moodle request failed: ${rawBody || response.statusText}`,
      );
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'exception' in payload &&
      payload.exception
    ) {
      throw new BadRequestException(this.formatMoodleError(wsFunction, payload));
    }

    return payload as T;
  }

  private parseMoodleResponse<T>(rawBody: string): MoodleResponse<T>['payload'] {
    if (!rawBody.trim()) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as T | MoodleException | null;
    } catch {
      throw new BadRequestException(
        `Moodle returned an invalid response: ${rawBody}`,
      );
    }
  }

  async createUser(payload: MoodleUserPayload): Promise<MoodleCreatedUser> {
    const params = new URLSearchParams();

    params.set('users[0][username]', payload.username);
    params.set('users[0][password]', payload.password);
    params.set('users[0][firstname]', payload.firstname);
    params.set('users[0][lastname]', payload.lastname);
    params.set('users[0][email]', payload.email);
    params.set('users[0][auth]', 'manual');

    const createdUsers = await this.callMoodle<MoodleCreatedUser[]>(
      'core_user_create_users',
      params,
    );

    if (!Array.isArray(createdUsers)) {
      throw new BadRequestException(
        'Moodle did not return a user list. Check whether core_user_create_users is enabled for this token.',
      );
    }

    const createdUser = createdUsers[0];

    if (!createdUser?.id) {
      throw new BadRequestException('Moodle did not return the created user.');
    }

    return createdUser;
  }

  async assignSystemRole(userId: number, roleId: number): Promise<void> {
    const params = new URLSearchParams();

    params.set('assignments[0][roleid]', String(roleId));
    params.set('assignments[0][userid]', String(userId));
    params.set('assignments[0][contextid]', '1');

    await this.callMoodle<unknown>('core_role_assign_roles', params);
  }

  async unassignSystemRole(userId: number, roleId: number): Promise<void> {
    const params = new URLSearchParams();

    params.set('unassignments[0][roleid]', String(roleId));
    params.set('unassignments[0][userid]', String(userId));
    params.set('unassignments[0][contextid]', '1');

    await this.callMoodle<unknown>('core_role_unassign_roles', params);
  }

  async deleteUser(userId: number): Promise<void> {
    const params = new URLSearchParams();

    params.set('userids[0]', String(userId));

    await this.callMoodle<unknown>('core_user_delete_users', params);
  }

  async updateUser(payload: {
    id: number;
    username?: string;
    password?: string;
    firstname?: string;
    lastname?: string | null;
    email?: string;
    suspended?: boolean;
  }): Promise<void> {
    const params = new URLSearchParams();

    params.set('users[0][id]', String(payload.id));

    if (payload.username !== undefined) {
      params.set('users[0][username]', payload.username);
    }

    if (payload.password !== undefined) {
      params.set('users[0][password]', payload.password);
    }

    if (payload.firstname !== undefined) {
      params.set('users[0][firstname]', payload.firstname);
    }

    if (payload.lastname !== undefined) {
      params.set('users[0][lastname]', payload.lastname || payload.firstname || '');
    }

    if (payload.email !== undefined) {
      params.set('users[0][email]', payload.email);
    }

    if (payload.suspended !== undefined) {
      params.set('users[0][suspended]', payload.suspended ? '1' : '0');
    }

    await this.callMoodle<unknown>('core_user_update_users', params);
  }

  async updateUserPicture(payload: {
    userId: number;
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    };
  }): Promise<void> {
    const config = await this.getMoodleConfig();
    const draftItemId = 0;
    const fileName = this.sanitizeFileName(payload.file.originalname);
    const formData = new FormData();
    const uploadBody = new ArrayBuffer(payload.file.buffer.byteLength);
    new Uint8Array(uploadBody).set(payload.file.buffer);
    const fileBlob = new Blob([uploadBody], {
      type: payload.file.mimetype,
    });

    formData.set('token', config.token);
    formData.set('contextlevel', 'user');
    formData.set('instanceid', String(payload.userId));
    formData.set('component', 'user');
    formData.set('filearea', 'draft');
    formData.set('itemid', String(draftItemId));
    formData.set('filepath', '/');
    formData.set('file_1', fileBlob, fileName);

    const uploadResponse = await fetch(`${config.baseUrl}/webservice/upload.php`, {
      method: 'POST',
      body: formData,
    });
    const rawBody = await uploadResponse.text();
    const uploadedPayload =
      this.parseMoodleResponse<MoodleUploadResponseFile[]>(rawBody);

    if (!uploadResponse.ok) {
      throw new BadRequestException(
        `Moodle upload failed: ${rawBody || uploadResponse.statusText}`,
      );
    }

    if (
      uploadedPayload &&
      typeof uploadedPayload === 'object' &&
      'exception' in uploadedPayload &&
      uploadedPayload.exception
    ) {
      throw new BadRequestException(
        this.formatMoodleError('webservice/upload.php', uploadedPayload),
      );
    }

    const uploaded = Array.isArray(uploadedPayload) ? uploadedPayload[0] : null;

    if (!uploaded?.itemid) {
      throw new BadRequestException(
        `Moodle upload did not return a draft item id. ${rawBody}`,
      );
    }

    const pictureParams = new URLSearchParams();
    pictureParams.set('draftitemid', String(uploaded.itemid));
    pictureParams.set('delete', '0');
    pictureParams.set('userid', String(payload.userId));

    await this.callMoodle<unknown>('core_user_update_picture', pictureParams);
  }

  private sanitizeFileName(value: string): string {
    const fallback = `profile-${Date.now()}.jpg`;
    const sanitized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return sanitized || fallback;
  }

  async findUserByField(
    field: 'id' | 'username' | 'email',
    value: string | number,
  ): Promise<MoodleUser | null> {
    const params = new URLSearchParams();

    params.set('field', field);
    params.set('values[0]', String(value));

    const users = await this.callMoodle<MoodleUser[]>(
      'core_user_get_users_by_field',
      params,
    );

    return users[0] ?? null;
  }

  async createCategory(payload: {
    name: string;
    description?: string | null;
    parent?: number;
  }): Promise<MoodleCreatedCategory> {
    const params = new URLSearchParams();

    params.set('categories[0][name]', payload.name);
    params.set('categories[0][parent]', String(payload.parent ?? 0));

    if (payload.description) {
      params.set('categories[0][description]', payload.description);
    }

    const categories = await this.callMoodle<MoodleCreatedCategory[]>(
      'core_course_create_categories',
      params,
    );

    const category = categories[0];

    if (!category?.id) {
      throw new BadRequestException('Moodle did not return the created category.');
    }

    return category;
  }

  async updateCategory(payload: {
    id: number;
    name?: string;
    description?: string | null;
  }): Promise<void> {
    const params = new URLSearchParams();

    params.set('categories[0][id]', String(payload.id));

    if (payload.name !== undefined) {
      params.set('categories[0][name]', payload.name);
    }

    if (payload.description !== undefined) {
      params.set('categories[0][description]', payload.description ?? '');
    }

    await this.callMoodle<unknown>('core_course_update_categories', params);
  }

  async deleteCategory(categoryId: number): Promise<void> {
    const params = new URLSearchParams();

    params.set('categories[0][id]', String(categoryId));
    params.set('categories[0][recursive]', '0');

    await this.callMoodle<unknown>('core_course_delete_categories', params);
  }

  async createCourse(payload: {
    fullname: string;
    shortname: string;
    categoryId: number;
    summary?: string | null;
    visible?: string | null;
    startdate?: Date | null;
    enddate?: Date | null;
  }): Promise<MoodleCreatedCourse> {
    const params = new URLSearchParams();

    params.set('courses[0][fullname]', payload.fullname);
    params.set('courses[0][shortname]', payload.shortname);
    params.set('courses[0][categoryid]', String(payload.categoryId));

    if (payload.summary) {
      params.set('courses[0][summary]', payload.summary);
      params.set('courses[0][summaryformat]', '1');
    }

    if (payload.visible !== null && payload.visible !== undefined) {
      params.set('courses[0][visible]', payload.visible === '0' ? '0' : '1');
    }

    if (payload.startdate) {
      params.set(
        'courses[0][startdate]',
        String(Math.floor(payload.startdate.getTime() / 1000)),
      );
    }

    if (payload.enddate) {
      params.set(
        'courses[0][enddate]',
        String(Math.floor(payload.enddate.getTime() / 1000)),
      );
    }

    const courses = await this.callMoodle<MoodleCreatedCourse[]>(
      'core_course_create_courses',
      params,
    );

    const course = courses[0];

    if (!course?.id) {
      throw new BadRequestException('Moodle did not return the created course.');
    }

    return course;
  }

  async updateCourse(payload: {
    id: number;
    fullname?: string;
    shortname?: string;
    categoryId?: number;
    summary?: string | null;
    visible?: string | null;
    startdate?: Date | null;
    enddate?: Date | null;
  }): Promise<void> {
    const params = new URLSearchParams();

    params.set('courses[0][id]', String(payload.id));

    if (payload.fullname !== undefined) {
      params.set('courses[0][fullname]', payload.fullname);
    }

    if (payload.shortname !== undefined) {
      params.set('courses[0][shortname]', payload.shortname);
    }

    if (payload.categoryId !== undefined) {
      params.set('courses[0][categoryid]', String(payload.categoryId));
    }

    if (payload.summary !== undefined) {
      params.set('courses[0][summary]', payload.summary ?? '');
      params.set('courses[0][summaryformat]', '1');
    }

    if (payload.visible !== undefined) {
      params.set('courses[0][visible]', payload.visible === '0' ? '0' : '1');
    }

    if (payload.startdate !== undefined) {
      params.set(
        'courses[0][startdate]',
        payload.startdate
          ? String(Math.floor(payload.startdate.getTime() / 1000))
          : '0',
      );
    }

    if (payload.enddate !== undefined) {
      params.set(
        'courses[0][enddate]',
        payload.enddate
          ? String(Math.floor(payload.enddate.getTime() / 1000))
          : '0',
      );
    }

    await this.callMoodle<unknown>('core_course_update_courses', params);
  }

  async deleteCourse(courseId: number): Promise<void> {
    const params = new URLSearchParams();

    params.set('courseids[0]', String(courseId));

    await this.callMoodle<unknown>('core_course_delete_courses', params);
  }

  async findCourseById(courseId: number): Promise<MoodleCourse | null> {
    const params = new URLSearchParams();

    params.set('field', 'id');
    params.set('value', String(courseId));

    const response = await this.callMoodle<{
      courses?: MoodleCourse[];
    }>('core_course_get_courses_by_field', params);

    return response.courses?.[0] ?? null;
  }

  async enrollUser(payload: {
    userId: number;
    courseId: number;
    roleId: number;
  }): Promise<void> {
    const params = new URLSearchParams();

    params.set('enrolments[0][roleid]', String(payload.roleId));
    params.set('enrolments[0][userid]', String(payload.userId));
    params.set('enrolments[0][courseid]', String(payload.courseId));

    await this.callMoodle<unknown>('enrol_manual_enrol_users', params);
  }

  async unenrollUser(payload: {
    userId: number;
    courseId: number;
    roleId: number;
  }): Promise<void> {
    const params = new URLSearchParams();

    params.set('enrolments[0][roleid]', String(payload.roleId));
    params.set('enrolments[0][userid]', String(payload.userId));
    params.set('enrolments[0][courseid]', String(payload.courseId));

    await this.callMoodle<unknown>('enrol_manual_unenrol_users', params);
  }

  async requestLoginUrl(payload: {
    moodleUserId?: number | null;
    username: string;
    email: string;
    courseId?: number | null;
  }): Promise<string> {
    const config = await this.getMoodleConfig();
    const attempts = [['email', payload.email]].filter(([, value]) => value);
    const errors: string[] = [];

    for (const [field, value] of attempts) {
      const params = new URLSearchParams();
      params.set('user[email]', payload.email);
      params.set(`user[${field}]`, value);

      try {
        const response = await this.callMoodle<MoodleLoginUrlResponse>(
          'auth_userkey_request_login_url',
          params,
        );

        if (!response?.loginurl) {
          throw new BadRequestException(
            'Moodle did not return a userkey login URL.',
          );
        }

        if (!payload.courseId) {
          return response.loginurl;
        }

        const loginUrl = new URL(response.loginurl);
        loginUrl.searchParams.set(
          'wantsurl',
          `${config.baseUrl}/course/view.php?id=${payload.courseId}`,
        );

        return loginUrl.toString();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('userkey authentication plugin is disabled')) {
          throw new BadRequestException(
            'Moodle automatic login is disabled. Enable the userkey authentication plugin in Moodle before using login from the system.',
          );
        }

        errors.push(message);
      }
    }

    throw new BadRequestException(
      `Unable to generate Moodle login URL. ${errors.join(' | ')}`,
    );
  }
}
