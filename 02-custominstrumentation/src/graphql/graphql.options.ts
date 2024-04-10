import { CallHandler, ExecutionContext, NestInterceptor, Injectable } from '@nestjs/common';
import { GqlOptionsFactory, GqlExecutionContext } from '@nestjs/graphql';
import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { useResponseCache } from '@envelop/response-cache';
import { useLogger, type SetSchemaFn, type Plugin } from '@envelop/core';

import { DocumentNode, GraphQLArgs, GraphQLSchema } from 'graphql';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { setDataSource } from 'nestjs-graphql-easy';
import config from 'config';

import { LoggerStore } from '../logger/logger.store';

import { GraphQLSchemaLoaderService } from './schema-loader/schema-loader.service';
import { Observable, tap } from 'rxjs';

// import { useOpenTelemetry } from '@envelop/opentelemetry';
import { SpanKind, trace, context as ctx } from '@opentelemetry/api';

const GRAPHQL_SETTINGS = config.get<IGraphQLSettings>('GRAPHQL_SETTINGS');
// Get the tracer
const gqlTracer = trace.getTracer('graphql');

const setSchemaUpdater: (setFn: (schemaUpdater: SetSchemaFn) => GraphQLSchema) => Plugin = (fn) => ({
  onPluginInit({ setSchema: set_schema }) {
    fn(set_schema);
  },
});

@Injectable()
export class GraphQLFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const { req } = gqlContext.getContext();

    const activeSpan = trace.getActiveSpan();
    activeSpan.setAttribute('graphql.operation.name', req.body.operationName);
    activeSpan.setAttribute('graphql.operation.query', req.body.query);
    activeSpan.setAttribute('graphql.operation.type', info.operation.operation);

    // Execute the next handler in the chain
    return next.handle().pipe(
      tap((response) => {
        console.log(JSON.stringify(response));
      })
    );
  }
}

@Injectable()
export class GraphQLOptions implements GqlOptionsFactory {
  public schemaUpdater: SetSchemaFn = null;

  constructor(private readonly dataSource: DataSource, private readonly schemaLoaderService: GraphQLSchemaLoaderService) {
    setDataSource(this.dataSource);

    this.schemaLoaderService.schema$.subscribe((schema: GraphQLSchema) => {
      if (this.schemaUpdater != null) {
        this.schemaUpdater(schema);
      }
    });
  }

  public setSchemaUpdater(updater: SetSchemaFn) {
    this.schemaUpdater = updater;
  }

  public createGqlOptions(): Promise<YogaDriverConfig> | YogaDriverConfig {
    return {
      ...GRAPHQL_SETTINGS,
      autoSchemaFile: true,
      driver: YogaDriver,
      context: ({ req }: { req: Request & { logger_store: LoggerStore; current_user: ICurrentUser } }) => ({
        req,
        logger_store: req.logger_store,
        current_user: req.current_user || ({ id: 1 } as ICurrentUser),
      }),
      transformSchema: async (schema: GraphQLSchema) => {
        this.schemaLoaderService.setCurrentSchema(schema);

        await this.schemaLoaderService.reloadSchemas();

        return this.schemaLoaderService.schema$.value;
      },
      plugins: [
        // useOpenTelemetry(
        //   {
        //     resolvers: true, // Tracks resolvers calls, and tracks resolvers thrown errors
        //     variables: true, // Includes the operation variables values as part of the metadata collected
        //     result: true, // Includes execution result object as part of the metadata collected
        //   },
        //   trace.getTracerProvider(),
        //   SpanKind.SERVER
        // ),
        setSchemaUpdater(this.setSchemaUpdater.bind(this)),
        useResponseCache({
          session: ({ current_user }: { current_user: ICurrentUser }) => String(current_user.id),
          ttl: process.env.CACHE_TTL ? +process.env.CACHE_TTL : 5_000,
          invalidateViaMutation: true,
        }),
        useLogger({
          logFn: (
            event_name: string,
            {
              args,
            }: {
              args: GraphQLArgs & {
                document: DocumentNode;
                contextValue: {
                  req: Request;
                  logger_store: LoggerStore;
                  params: {
                    query: string;
                  };
                };
              };
              result?: unknown;
            }
          ) => {
            const ctx = args.contextValue;
            const logger_store: LoggerStore = ctx.logger_store;

            let operation: string;
            const selections: string[] = [];
            args.document.definitions.forEach((definition) => {
              if (definition.kind === 'OperationDefinition') {
                operation = definition.operation;
                definition.selectionSet.selections.forEach((selection, i) => {
                  if (selection.kind === 'Field') {
                    selections.push(selection.name.value);
                  }
                });
              }
            });

            logger_store.info(`GraphQL ${event_name}`, { event: event_name, operation, selections });
            const logStmt = `GraphQL ${operation} - ${selections.join(', ')}`;
            const span = trace.getActiveSpan();
            span.setAttribute('graphql.event_name', logStmt);
          },
        }),
      ],
    };
  }
}
