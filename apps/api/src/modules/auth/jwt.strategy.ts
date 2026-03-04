import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  institutionId?: string | null;
  isSuperAdmin?: boolean;
  institutionUserId?: string | null;
  jti?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { 
      id: payload.sub, 
      email: payload.email, 
      roles: payload.roles,
      institutionId: payload.institutionId || null,
      isSuperAdmin: payload.isSuperAdmin === true,
      institutionUserId: payload.institutionUserId || null,
      jti: payload.jti || null,
    };
  }
}
