import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { FoldersService } from './folders.service';
import { FolderContentsDto } from './dto/folder-contents.dto';
import { FolderContentsEntity } from './entities/folder-contents.entity';
import type { FolderContentsResponse } from './folder.types';

@Resolver()
@UseGuards(SessionJwtGuard)
export class FoldersResolver {
  constructor(private readonly folders: FoldersService) {}

  @Query(() => FolderContentsEntity)
  folderContents(
    @Context('req') request: AuthenticatedRequest,
    @Args() { parentId, includeFiles }: FolderContentsDto,
  ): Promise<FolderContentsResponse> {
    return this.folders.listContents(request.authContext!.userId, parentId ?? null, includeFiles ?? true);
  }
}
