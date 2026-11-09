import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import type { StoredFileResponse, StoredFileStatus } from '../../files/file.types';
import type { FolderContentsResponse, FolderResponse } from '../folder.types';

@ObjectType('FolderMetadata')
export class FolderMetadataEntity implements FolderResponse {
  @Field(() => String, { nullable: true }) description?: string | null;
  @Field(() => Float, { nullable: true }) storageBytes?: number;
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => ID) ownerId!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field(() => String, { nullable: true }) permission?: 'OWNER' | 'READER' | 'EDITOR';
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType('FolderFileMetadata')
export class FolderFileMetadataEntity implements StoredFileResponse {
  @Field(() => String, { nullable: true }) description?: string | null;
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() contentType!: string;
  @Field(() => Float) sizeBytes!: number;
  @Field(() => String) status!: StoredFileStatus;
  @Field(() => String, { nullable: true }) checksum!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
  @Field(() => String, { nullable: true }) deletedAt!: string | null;
  @Field(() => ID, { nullable: true }) ownerId?: string | null;
  @Field(() => String, { nullable: true }) ownerName?: string;
  @Field(() => ID, { nullable: true }) folderId?: string | null;
  @Field(() => String, { nullable: true }) folderName?: string | null;
  @Field(() => String, { nullable: true }) openedAt?: string | null;
  @Field(() => String, { nullable: true }) permission?: 'OWNER' | 'READER' | 'EDITOR';
}

@ObjectType('FolderContents')
export class FolderContentsEntity implements FolderContentsResponse {
  @Field(() => FolderMetadataEntity, { nullable: true }) folder!: FolderResponse | null;
  @Field(() => [FolderMetadataEntity]) breadcrumbs!: FolderResponse[];
  @Field(() => [FolderMetadataEntity]) folders!: FolderResponse[];
  @Field(() => [FolderFileMetadataEntity]) files!: StoredFileResponse[];
}
