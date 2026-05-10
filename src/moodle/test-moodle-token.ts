import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { typeOrmConfig } from '../database/typeorm.config';
import { Setting } from '../setting/setting.entity';

type MoodleSiteInfo = {
  sitename?: string;
  siteurl?: string;
  username?: string;
  userid?: number;
};

type MoodleException = {
  exception?: string;
  errorcode?: string;
  message?: string;
  debuginfo?: string;
};

loadEnv();

function isMoodleException(
  payload: MoodleSiteInfo | MoodleException,
): payload is MoodleException {
  return 'exception' in payload && Boolean(payload.exception);
}

function normalizeMoodleUrl(rawUrl: string): string {
  const normalizedUrl = rawUrl.trim().replace(/[?&]+$/, '');

  if (
    normalizedUrl.startsWith('http://localhost') ||
    normalizedUrl.startsWith('http://127.0.0.1')
  ) {
    return normalizedUrl;
  }

  return normalizedUrl.replace(/^http:\/\//, 'https://');
}

async function main() {
  const dataSource = new DataSource(typeOrmConfig);
  await dataSource.initialize();

  try {
    const [setting] = await dataSource.getRepository(Setting).find({
      order: {
        id: 'DESC',
      },
      take: 1,
    });

    if (!setting?.moodleUrl || !setting.moodleToken) {
      throw new Error('No Moodle URL/token found in the latest setting.');
    }

    const moodleUrl = normalizeMoodleUrl(setting.moodleUrl);
    const endpoint = moodleUrl.endsWith('/webservice/rest/server.php')
      ? moodleUrl
      : `${moodleUrl.replace(/\/+$/, '')}/webservice/rest/server.php`;
    const params = new URLSearchParams({
      wstoken: setting.moodleToken.trim(),
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json',
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const rawBody = await response.text();
    let payload: MoodleSiteInfo | MoodleException;

    try {
      payload = JSON.parse(rawBody) as MoodleSiteInfo | MoodleException;
    } catch {
      throw new Error(`Moodle returned a non-JSON response: ${rawBody}`);
    }

    if (isMoodleException(payload)) {
      if (payload.errorcode === 'accessexception') {
        console.log('Moodle token exists, but this test function is not allowed for the token.');
        console.log(`Message: ${payload.message ?? '-'}`);
        console.log(`Debug: ${payload.debuginfo ?? '-'}`);
        return;
      }

      throw new Error(
        `Moodle token test failed: ${payload.errorcode ?? payload.exception} - ${payload.message ?? 'No message'}`,
      );
    }

    console.log('Moodle token OK');
    console.log(`Site: ${payload.sitename ?? '-'}`);
    console.log(`URL: ${payload.siteurl ?? setting.moodleUrl}`);
    console.log(`User: ${payload.username ?? '-'} (${payload.userid ?? '-'})`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
