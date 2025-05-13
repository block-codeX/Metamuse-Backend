import { config } from 'dotenv';

config();
// JWT
export const COOKIE_SECRET = process.env.COOKIE_SECRET as string;
export const CORS_ALLOWED = (process.env.CORS_ALLOWED as string).split(' ');
export const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS as string).split(' ')
export const JWT_SIGNING_KEY = process.env.JWT_SIGNING_KEY as string;
export const JWT_VERIFYING_KEY = process.env.JWT_VERIFYING_KEY as string;
export const JWT_ACCESS_TOKEN_EXPIRATION = parseInt(
  process.env.JWT_ACCESS_TOKEN_EXPIRATION as string,
);
export const JWT_SIGNED_TOKEN_EXPIRY = process.env.JWT_SIGNED_TOKEN_EXPIRY as string;
export const JWT_REFRESH_TOKEN_EXPIRATION = parseInt(
  process.env.JWT_REFRESH_TOKEN_EXPIRATION as string,
);
export const JWT_AUTH_HEADERS = (process.env.JWT_AUTH_HEADERS as string).split(
  ' ',
);
export const JWT_ALGORITHM = "HS256";

// OTP
export const OTP_EXPIRATION = parseInt(process.env.OTP_EXPIRATION as string);
export const OTP_LENGTH = parseInt(process.env.OTP_LENGTH as string);
// Database
export const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING as string;
export const DB_NAME = "metamuse"
// Server
export const PORT = parseInt(process.env.PORT as string);

// Conversation
export const CONVERSATION_MAX_MEMBERS = 200;


// SUI
export const SUI_RPC_URL = process.env.SUI_RPC_URL as string;
export const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY as string;
export const SUI_CONTRACT_ADDRESS = process.env.SUI_CONTRACT_ADDRESS as string;

// Zoho

export const EMAIL_HOST = process.env.EMAIL_HOST as string;
export const EMAIL_PORT = parseInt(process.env.EMAIL_PORT as string);
export const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
export const EMAIL_USER = process.env.EMAIL_USER as string;
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD as string;
export const EMAIL_FROM = process.env.EMAIL_FROM as string;
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME as string;

// Frontend
export const FRONTEND_URL = process.env.FRONTEND_URL as string;

// CRDT Layer
export const REDIS_URL = process.env.AH_REDIS_STACKHERO_BLACK_URL_TLS as string;
export const YJS_HOST = process.env.AH_REDIS_STACKHERO_BLACK_HOST as string;
export const YJS_PORT = process.env.AH_REDIS_STACKHERO_BLACK_PORT_TLS as string;
export const YJS_USERNAME = process.env.AH_REDIS_STACKHERO_BLACK_USER as string;
export const YJS_PASSWORD = process.env.AH_REDIS_STACKHERO_BLACK_PASSWORD as string;
// CRYPTO
export const CRYPTO_SECRET = process.env.CRYPTO_SECRET as string;

// blockchain
// export const SUI_CONTRACT_ADDRESS = process.env.SUI_CONTRACT_ADDRESS as string;
