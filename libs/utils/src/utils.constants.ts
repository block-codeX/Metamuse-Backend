import { config } from 'dotenv';
import { Algorithm } from 'jsonwebtoken';

config();

// JWT
export const JWT_SIGNING_KEY = process.env.JWT_SIGNING_KEY as string;
export const JWT_VERIFYING_KEY = process.env.JWT_VERIFYING_KEY as string;
export const JWT_ACCESS_TOKEN_EXPIRATION = parseInt(
  process.env.JWT_ACCESS_TOKEN_EXPIRATION as string,
);
export const JWT_REFRESH_TOKEN_EXPIRATION = parseInt(
  process.env.JWT_REFRESH_TOKEN_EXPIRATION as string,
);
export const JWT_AUTH_HEADERS = (process.env.JWT_AUTH_HEADERS as string).split(
  ' ',
);
export const JWT_ALGORITHM: Algorithm = "HS256"//= process.env.JWT_ALGORITHM as Algorithm;

// OTP
export const OTP_EXPIRATION = parseInt(process.env.OTP_EXPIRATION as string);
export const OTP_LENGTH = parseInt(process.env.OTP_LENGTH as string);
// Database
export const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING as string;

// Server
export const PORT = parseInt(process.env.NEST_PORT as string);

// Conversation
export const CONVERSATION_MAX_MEMBERS = 200;
