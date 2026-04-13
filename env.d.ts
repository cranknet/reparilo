// biome-ignore lint/style/noNamespace: standard Node.js ProcessEnv augmentation pattern
declare namespace NodeJS {
  interface ProcessEnv {
    AI_ENCRYPTION_KEY: string;
    BETTER_AUTH_SECRET: string;
    DATABASE_URL: string;
    HOST: string;
    NODE_ENV: "development" | "production" | "test";
    PORT: string;
    UPLOAD_DIR: string;
  }
}
