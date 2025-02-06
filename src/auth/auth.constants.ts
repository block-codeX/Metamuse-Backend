import { config } from 'dotenv';

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
export const JWT_AUTH_HEADERS = (process.env.JWT_AUTH_HEADER as string).split(
  ' ',
);
export const JWT_ALGORITHM = process.env.JWT_ALGORITHM as string;

// Database
export const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING as string;

// Server
export const PORT = parseInt(process.env.NEST_PORT as string);
