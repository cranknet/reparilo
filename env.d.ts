declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    HOST: string;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    AI_ENCRYPTION_KEY: string;
    UPLOAD_DIR: string;
  }
}
