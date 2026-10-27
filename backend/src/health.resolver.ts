import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, { name: 'health' })
  getHealth(): string {
    return 'ok';
  }
}
