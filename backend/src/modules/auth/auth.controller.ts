import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PasswordService } from './password.service';
import {
  PasswordChangeDto,
  PasswordLoginDto,
  PasswordRegisterDto,
  PasswordForgotDto,
  PasswordResetDto,
} from './dto/password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwords: PasswordService,
  ) {}

  @Public()
  @Post('password/register/request-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestRegistrationOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Post('password/register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new customer with username and password' })
  registerPassword(@Body() dto: PasswordRegisterDto) {
    return this.passwords.register(dto);
  }

  @Public()
  @Post('password/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with username and password' })
  loginPassword(@Body() dto: PasswordLoginDto, @Req() req: { ip: string }) {
    return this.passwords.login(dto.username, dto.password, req.ip);
  }

  @Public()
  @Post('password/forgot/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestPasswordReset(@Body() dto: PasswordForgotDto) {
    return this.passwords.forgotRequest(dto);
  }

  @Public()
  @Post('password/forgot/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.passwords.forgotReset(dto);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password and revoke previous sessions' })
  changePassword(
    @CurrentUser('sub') userId: number,
    @Body() dto: PasswordChangeDto,
    @Req() req: { ip: string },
  ) {
    return this.passwords.change(userId, dto.currentPassword, dto.newPassword, req.ip);
  }

  @Public()
  @Post('otp/request')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Request OTP code' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP and login/register' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (invalidate refresh token)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@CurrentUser('sub') userId: number, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(userId, dto.refreshToken);
  }
}
