import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsUUID } from 'class-validator';

@ArgsType()
export class FolderContentsDto {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
