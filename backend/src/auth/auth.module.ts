import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionCookieGuard } from './session-cookie.guard';
import { SessionJwtGuard } from './session-jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, SessionJwtGuard, SessionCookieGuard],
  exports: [SessionJwtGuard, JwtModule],
})
export class AuthModule {}
