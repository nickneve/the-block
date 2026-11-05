import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, ErrorBody } from './domain-error';

/** Every error leaves the API as `{ code, message, details? }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorBody(exception);
    response.status(status).json(body);
  }

  private toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      return { status: exception.getStatus(), body: exception.getResponse() as ErrorBody };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const messages = typeof raw === 'object' && raw !== null ? (raw as { message?: unknown }).message : raw;

      if (status === HttpStatus.BAD_REQUEST) {
        return {
          status,
          body: {
            code: 'VALIDATION_FAILED',
            message: Array.isArray(messages) ? messages.join('; ') : String(messages ?? 'Invalid request'),
          },
        };
      }

      return {
        status,
        body: { code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'INTERNAL_ERROR', message: exception.message },
      };
    }

    this.logger.error(exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
    };
  }
}
