import { CORS_ALLOWED, REDIS_URL } from '../libs/utils/src/utils.constants';
import { config } from 'dotenv';
import { FastifyCorsOptions } from '@fastify/cors';
config()
const CorsOptions: FastifyCorsOptions = {
    origin: CORS_ALLOWED,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization, x-csrf-token",
    credentials: true,
    maxAge: 86400,
};

export default CorsOptions