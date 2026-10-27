import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import type { GraphQLResolveInfo } from 'graphql';
import { Observable, tap } from 'rxjs';

export interface OperationLogger {
  log(message: string): void;
  warn(message: string): void;
}

interface OperationDetails {
  transport: 'REST' | 'GraphQL';
  operation: string;
  getStatusCode?: () => number;
}

@Injectable()
export class OperationLoggingInterceptor
  implements NestInterceptor<unknown, unknown>
{
  private readonly logger: OperationLogger;

  constructor(logger: OperationLogger = new Logger(OperationLoggingInterceptor.name)) {
    this.logger = logger;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const details = this.getOperationDetails(context);
    if (!details) {
      return next.handle();
    }

    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = details.getStatusCode?.();
          const status = statusCode === undefined ? '' : ` statusCode=${statusCode}`;
          this.logger.log(
            `[${details.transport}] ${details.operation} outcome=success${status} durationMs=${Date.now() - startedAt}`,
          );
        },
        error: (error: unknown) => {
          const statusCode = this.getErrorStatusCode(error);
          const status = statusCode === undefined ? '' : ` statusCode=${statusCode}`;
          this.logger.warn(
            `[${details.transport}] ${details.operation} outcome=error${status} durationMs=${Date.now() - startedAt}`,
          );
        },
      }),
    );
  }

  private getOperationDetails(context: ExecutionContext): OperationDetails | null {
    const contextType = context.getType<string>();

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<Request>();
      const response = context.switchToHttp().getResponse<Response>();
      const routePath = request.route?.path;
      const path = typeof routePath === 'string'
        ? `${request.baseUrl}${routePath}`
        : request.path;

      return {
        transport: 'REST',
        operation: `${request.method} ${path}`,
        getStatusCode: () => response.statusCode,
      };
    }

    if (contextType === 'graphql') {
      const info = GqlExecutionContext.create(context).getInfo<GraphQLResolveInfo>();
      const operationType = info.operation.operation;
      const operationName = info.operation.name?.value ?? 'anonymous';

      return {
        transport: 'GraphQL',
        operation: `${operationType} ${operationName} field=${info.fieldName}`,
      };
    }

    return null;
  }

  private getErrorStatusCode(error: unknown): number | undefined {
    return error instanceof HttpException ? error.getStatus() : undefined;
  }
}
