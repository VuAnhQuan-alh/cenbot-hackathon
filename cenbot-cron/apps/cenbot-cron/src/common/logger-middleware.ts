import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AppLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const { ip, method, baseUrl } = request;
    const userAgent = request.get('user-agent') || '';
    response.on('close', () => {
      const { statusCode } = response;
      const contentLength = request.get('content-length') || 0;

      if (
        statusCode !== 200 &&
        statusCode !== 201 &&
        statusCode !== 304 &&
        statusCode !== 302
      ) {
        this.logger.error(
          `${method} ${statusCode} ${baseUrl} ${contentLength} - ${userAgent} ${ip}`,
        );
      } else {
        this.logger.log(
          `${method} ${statusCode} ${baseUrl} ${contentLength} - ${userAgent} ${ip}`,
        );
      }
    });

    next();
  }
}
