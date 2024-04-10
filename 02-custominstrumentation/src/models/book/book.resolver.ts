import { Context, GraphQLExecutionContext, Info, Parent, Resolver } from '@nestjs/graphql';

import { Query, ResolveField, ELoaderType, Loader, Filter, Order, Pagination } from 'nestjs-graphql-easy';
import { trace, context, Span } from '@opentelemetry/api';

import { Section } from '../section/section.entity';
import { Book } from './book.entity';

const gqlTracer = trace.getTracer('graphql');

@Resolver(() => Book)
export class BookResolver {
  @Query(() => [Book])
  public async books(
    @Info() info: any,
    @Loader({
      loader_type: ELoaderType.MANY,
      field_name: 'books',
      entity: () => Book,
      entity_fk_key: 'id',
    })
    field_alias: string,
    @Filter(() => Book) _filter: unknown,
    @Order(() => Book) _order: unknown,
    @Pagination() _pagination: unknown,
    @Context() ctx: GraphQLExecutionContext
  ) {
    const fields: string[] = [];
    info.fieldNodes[0].selectionSet.selections.forEach((selection: any) => {
      if (selection.kind === 'Field') {
        fields.push(selection.name.value);
      }
    });

    let childSpanExt: Span;
    context.with(context.active(), () => {
      gqlTracer.startActiveSpan(info.fieldName, (childSpan) => {
        childSpanExt = childSpan;
        childSpan.setAttribute('graphql.operation.type', info.operation.operation);
        childSpan.setAttribute('graphql.operation.name', info.operation.name.value);
        childSpan.setAttribute('graphql.operation.selectionSet', fields);
      });
    });

    try {
      const resolverResponse = await ctx[field_alias];
      childSpanExt.setAttribute('graphql.resolver.response', JSON.stringify(resolverResponse));
      childSpanExt.end();
      return resolverResponse;
    } finally {
      console.log('Done');
    }
  }

  @ResolveField(() => [Section], { nullable: true })
  public async sections(
    @Info() info: any,
    @Parent() book: Book,
    @Loader({
      loader_type: ELoaderType.ONE_TO_MANY,
      field_name: 'sections',
      entity: () => Section,
      entity_fk_key: 'book_id',
    })
    field_alias: string,
    @Filter(() => Section) _filter: unknown,
    @Order(() => Section) _order: unknown,
    @Context() ctx: GraphQLExecutionContext
  ): Promise<Section[]> {
    return await ctx[field_alias].load(book.id);
  }
}
