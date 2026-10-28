import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { clearAuthenticationCookies, setAuthenticationCookies } from './auth-cookie.util';
import type { AuthenticatedRequest } from './auth-request.types';
import { AuthService } from './auth.service';
import { SessionCookieGuard } from './session-cookie.guard';
import { SessionJwtGuard } from './session-jwt.guard';
import type { AuthSessionContext, PublicUserResponse } from './auth.types';

class PublicUserResponseDto implements PublicUserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'email' })
  email!: string;
  @ApiProperty({ nullable: true })
  name!: string | null;
  @ApiProperty({ nullable: true, format: 'uri' })
  pictureUrl!: string | null;
}

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @ApiOperation({ summary: 'Inicia el flujo OAuth 2.0 con Google' })
  @ApiResponse({ status: 302, description: 'Redirige al consentimiento de Google.' })
  async startGoogleLogin(@Res() response: Response): Promise<void> {
    const authorizationUrl = await this.authService.createGoogleAuthorizationUrl();
    response.redirect(302, authorizationUrl);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Procesa el callback OpenID Connect de Google' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiResponse({ status: 302, description: 'Crea la sesión y redirige a la plataforma.' })
  async completeGoogleLogin(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (error) {
      response.redirect(302, `${this.authService.getFrontendOrigin()}/?loginError=google`);
      return;
    }

    try {
      const result = await this.authService.completeGoogleLogin(code, state);
      setAuthenticationCookies(response, result);
      response.redirect(302, this.authService.getFrontendOrigin());
    } catch {
      response.redirect(302, `${this.authService.getFrontendOrigin()}/?loginError=google`);
    }
  }

  @Get('me')
  @UseGuards(SessionJwtGuard)
  @ApiCookieAuth('kornspace-access')
  @ApiOperation({ summary: 'Devuelve la identidad de la sesión autenticada' })
  @ApiOkResponse({ type: PublicUserResponseDto })
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<PublicUserResponse> {
    return this.authService.getCurrentUser(request.authContext?.userId ?? '');
  }

  @Post('refresh')
  @HttpCode(204)
  @UseGuards(SessionCookieGuard)
  @ApiCookieAuth('kornspace-session')
  @ApiOperation({ summary: 'Renueva el JWT mientras la sesión Redis esté activa' })
  @ApiNoContentResponse({ description: 'JWT de acceso renovado mediante cookie HttpOnly.' })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const session = request.authSession as AuthSessionContext;
    const result = await this.authService.refreshAccessToken(session);
    setAuthenticationCookies(response, result);
    response.status(204).send();
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionJwtGuard)
  @ApiCookieAuth('kornspace-access')
  @ApiOperation({ summary: 'Revoca la sesión activa y borra las cookies' })
  @ApiNoContentResponse({ description: 'Sesión revocada.' })
  async logout(@Req() request: AuthenticatedRequest, @Res() response: Response): Promise<void> {
    await this.authService.logout(request.authSession as AuthSessionContext);
    clearAuthenticationCookies(response);
    response.status(204).send();
  }
}
