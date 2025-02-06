import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BlacklistAccess, BlacklistRefresh } from './auth.schema';
import { ForbiddenError, IntegrityError, UnauthorizedError, ValidationError } from '@app/utils';
import { JWT_VERIFYING_KEY, JWT_ALGORITHM, JWT_SIGNING_KEY, JWT_REFRESH_TOKEN_EXPIRATION, JWT_ACCESS_TOKEN_EXPIRATION } from './auth.constants';
import jwt from 'jsonwebtoken'
interface AuthTokenResponse {
    accessToken: string
    userId: string
    refreshToken: string
    access_iat: string
    refresh_iat: string
    access_exp: string
    refresh_exp: string
  }
@Injectable()
export class AuthService {
    constructor(
        @InjectModel(BlacklistAccess.name) private blacklistAccessModel: Model<BlacklistAccess>,
        @InjectModel(BlacklistRefresh.name) private blacklistRefreshModel: Model<BlacklistRefresh>,
    ) { }

    async blacklistToken(token: string, model: 'access' | 'refresh'): Promise<void> {
        try {
            if (model == 'access') {
                await this.blacklistAccessModel.create({ token })
            } else if (model == 'refresh') {
                await this.blacklistRefreshModel.create({ token })
            } else {
                throw new ValidationError('Invalid model')
            }
        } catch (error) {
            throw new IntegrityError('Token already blacklisted')
        }
    }
    async isTokenBlacklisted (token: string, model: 'access' | 'refresh'): Promise<boolean> {
        let blacklist: BlacklistAccess | BlacklistRefresh | null = null;
        if (model === 'access') {
          blacklist = await this.blacklistAccessModel.findOne({ token }).lean()
        } else if (model === 'refresh') {
          blacklist = await this.blacklistRefreshModel.findOne({ token }).lean()
        }
        return blacklist != null
      }
      async clearBlacklist (): Promise<void> {
        await this.blacklistAccessModel.deleteMany({})
        await this.blacklistRefreshModel.deleteMany({})
      }
      async getTokens (
        user//: IUserDocument
      ): Promise<AuthTokenResponse> {
        const issuedAt = Math.floor(Date.now() / 1000) // current time in seconds since the epoch
        const accessTokenExpiry = issuedAt + 60 * 60 // 1 hour from now
        const refreshTokenExpiry = issuedAt + 60 * 60 * 24 * 7 // 7 days from now
        const payload = {
          sub: user._id.toHexString(),
          lastAuthChange: user.lastAuthChange,
          iat: Math.floor(Date.now() / 1000) // current time in seconds since the epoch
        }
      
        const accessToken = jwt.sign(
          { ...payload, type: 'access' },
          JWT_SIGNING_KEY as jwt.Secret,
          {
            expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
            algorithm: JWT_ALGORITHM as jwt.Algorithm
          }
        )
        const refreshToken = jwt.sign(
          { ...payload, type: 'refresh' },
          JWT_SIGNING_KEY as jwt.Secret,
          {
            expiresIn: JWT_REFRESH_TOKEN_EXPIRATION,
            algorithm: JWT_ALGORITHM as jwt.Algorithm
          }
        )
      
        return {
          accessToken,
          refreshToken,
          userId: user._id.toHexString(),
          access_iat: new Date(issuedAt * 1000).toISOString(),
          refresh_iat: new Date(issuedAt * 1000).toISOString(),
          access_exp: new Date(accessTokenExpiry * 1000).toISOString(),
          refresh_exp: new Date(refreshTokenExpiry * 1000).toISOString()
        }
      }
      
      async refreshTokens (oldRefreshToken: string): Promise<AuthTokenResponse> {
        try {
          if (await this.isTokenBlacklisted(oldRefreshToken, 'refresh')) {
            throw new ForbiddenError('Token blacklisted')
          }
          const decoded = jwt.verify(
            oldRefreshToken,
            JWT_VERIFYING_KEY as jwt.Secret,
            { algorithms: [JWT_ALGORITHM as jwt.Algorithm] }
          ) as jwt.JwtPayload
          if (decoded.type !== 'refresh') {
            throw new ForbiddenError('Invalid token type')
          }
          let user;
        //   const user = await getUser(Types.ObjectId.createFromHexString(decoded.sub ?? ''))
          if (user == null) {
            throw new ForbiddenError('User not found')
          }
          const newTokens = await this.getTokens(user)
          await this.blacklistToken(oldRefreshToken, 'refresh')
          return newTokens
        } catch (error) {
          throw new UnauthorizedError('Invalid token')
        }
    }
}
