import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

@ArgsType()
export class FolderContentsDto {
  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  includeFiles?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
