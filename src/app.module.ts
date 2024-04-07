import { MiddlewareConsumer, Module } from '@nestjs/common';

import { interval } from 'rxjs';

import { DatabaseModule } from './database/database.module';
import { HealthzModule } from './healthz/healthz.module';
import { LoggerModule } from './logger/logger.module';
import { LoggerMiddleware } from './logger/logger.middleware';
import { ModelsModule } from './models/models.module';
import { GraphQLModule } from './graphql/graphql.module';
import opentelemetry from '@opentelemetry/api';

@Module({
  imports: [LoggerModule, HealthzModule, DatabaseModule, ModelsModule, GraphQLModule],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor() {
    const formatMemoryUsage = (data: number) => `${Math.round((data / 1024 / 1024) * 100) / 100} MB`;

    interval(30_000).subscribe(() => {
      const memory_data = process.memoryUsage();
      const span = opentelemetry.trace.getActiveSpan();
      const memory_usage = {
        rss: `${formatMemoryUsage(memory_data.rss)} -> Resident Set Size - total memory allocated for the process execution`,
        heapTotal: `${formatMemoryUsage(memory_data.heapTotal)} -> total size of the allocated heap`,
        heapUsed: `${formatMemoryUsage(memory_data.heapUsed)} -> actual memory used during the execution`,
        external: `${formatMemoryUsage(memory_data.external)} -> V8 external memory`,
      };
      span.setAttribute('memory-usage-rss', memory_data.rss);
      span.setAttribute('memory-usage-heapTotal', memory_data.heapTotal);
      span.setAttribute('memory-usage-heapUsed', memory_data.heapUsed);
      span.setAttribute('memory-usage-external', memory_data.external);
      span.end();
      // eslint-disable-next-line no-console
      console.log(memory_usage);
    });
  }
  public configure(consumer: MiddlewareConsumer): void | MiddlewareConsumer {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
