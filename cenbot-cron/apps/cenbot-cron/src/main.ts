import { AppModule } from './app.module';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SentryFilter } from '@schema/schema-app';
import { VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import fetch from 'node-fetch';
import helmet from 'helmet';

// @ts-ignore
globalThis.fetch = fetch;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = process.env.PORT_BOT;

  app.enableCors();
  app.use(helmet());
  app.use(cookieParser());

  app.enableVersioning({ type: VersioningType.URI, prefix: 'v1' });
  app.setGlobalPrefix('api/v1', { exclude: ['oauth/twitter'] });

  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.BOT_SENTRY_DNS,
    });
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryFilter(httpAdapter));
    console.log('Sentry initial success!');
  }

  await app.listen(PORT);

  console.log(`🚀 Application is running on: ${await app.getUrl()}/api/v1`);
}
bootstrap();
