import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SchemaAppModule } from '@schema/schema-app';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BotsModule } from './bots/bots.module';
import { AppLoggerMiddleware } from './common/logger-middleware';
import { OauthModule } from './oauth/oauth.module';

@Module({
  imports: [SchemaAppModule, BotsModule, OauthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}
