import { UseGuards } from '@nestjs/common';
import { Args, Context, Field, Float, InputType, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { FileLibraryService, type LibraryFilters } from './file-library.service';

@InputType()
class LibraryFiltersInput implements LibraryFilters {
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(255) search?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(['image', 'video', 'audio', 'text', 'document']) kind?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsUUID() ownerId?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsDateString() modifiedAfter?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @Matches(/^(root|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/iu) folderId?: string;
  @Field(() => Boolean, { nullable: true }) @IsOptional() @IsBoolean() recent?: boolean;
  @Field(() => Boolean, { nullable: true }) @IsOptional() @IsBoolean() shared?: boolean;
}

@ObjectType()
class LibraryFile {
  @Field() id!: string;
  @Field() name!: string;
  @Field() contentType!: string;
  @Field(() => Float) sizeBytes!: number;
  @Field() status!: string;
  @Field(() => String, { nullable: true }) checksum!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
  @Field(() => String, { nullable: true }) deletedAt!: string | null;
  @Field(() => String, { nullable: true }) ownerId!: string | null;
  @Field() ownerName!: string;
  @Field(() => String, { nullable: true }) folderId!: string | null;
  @Field(() => String, { nullable: true }) folderName!: string | null;
  @Field() permission!: string;
  @Field(() => String, { nullable: true }) openedAt!: string | null;
}

@Resolver()
@UseGuards(SessionJwtGuard)
export class FileLibraryResolver {
  constructor(private readonly library: FileLibraryService) {}
  @Query(() => [LibraryFile])
  fileLibrary(@Context('req') request: AuthenticatedRequest, @Args('filters', { nullable: true }) filters?: LibraryFiltersInput) {
    return this.library.browse(request.authContext!.userId, filters);
  }
}
