import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { HealthController } from './health.controller';
import { HealthResolver } from './health.resolver';
import { PrismaModule } from './prisma/prisma.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { PreferencesModule } from './preferences/preferences.module';
import { FoldersModule } from './folders/folders.module';

interface GraphQLContextInput {
  req: Request;
  res: Response;
}

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    FilesModule,
    FoldersModule,
    PreferencesModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      graphiql: process.env.NODE_ENV === 'development',
      context: ({ req, res }: GraphQLContextInput) => ({ req, res }),
    }),
  ],
  controllers: [HealthController],
  providers: [HealthResolver],
})
export class AppModule {}
