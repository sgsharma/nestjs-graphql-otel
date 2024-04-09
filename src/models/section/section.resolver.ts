import { Context, GraphQLExecutionContext, Info, Parent, Resolver } from '@nestjs/graphql';

import { Query, ResolveField, ELoaderType, Loader, Filter, Order, Pagination } from 'nestjs-graphql-easy';
import { trace, context, Span } from '@opentelemetry/api';

import { Book } from '../book/book.entity';
import { Section } from './section.entity';

const gqlTracer = trace.getTracer('graphql');

@Resolver(() => Section)
export class SectionResolver {
  @Query(() => [Section])
  public async sections(
    @Info() info: any,
    @Loader({
      loader_type: ELoaderType.MANY,
      field_name: 'sections',
      entity: () => Section,
      entity_fk_key: 'id',
    })
    field_alias: string,
    @Filter(() => Section) _filter: unknown,
    @Order(() => Section) _order: unknown,
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
        childSpan.setAttribute('graphql.operation.selectionSet', info.operation.selectionSet.selections);
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

  @ResolveField(() => Book, { nullable: false })
  public async book(
    @Parent() section: Section,
    @Loader({
      loader_type: ELoaderType.MANY_TO_ONE,
      field_name: 'book',
      entity: () => Book,
      entity_fk_key: 'id',
    })
    field_alias: string,
    @Context() ctx: GraphQLExecutionContext
  ): Promise<Book> {
    return await ctx[field_alias].load(section.book_id);
  }
}
