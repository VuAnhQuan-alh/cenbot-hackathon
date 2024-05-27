import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SentryFilter } from '@schema/schema-app';
import * as Sentry from '@sentry/node';

import { CronjobModule } from './cronjob.module';

async function bootstrap() {
  const app = await NestFactory.create(CronjobModule);
  const PORT = process.env.PORT_CRON;

  app.enableCors();
  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.CRON_SENTRY_DNS,
    });
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryFilter(httpAdapter));
    console.log('Sentry initial success!');
  }

  await app.listen(PORT);

  console.log(`🚀 Application is running on: ${await app.getUrl()}/api`);
}
bootstrap();
