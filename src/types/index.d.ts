// Global type augmentations.

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      DIRECT_URL: string;
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      CLERK_SECRET_KEY: string;
      CLERK_WEBHOOK_SECRET: string;
      NEXT_PUBLIC_PUSHER_KEY: string;
      NEXT_PUBLIC_PUSHER_CLUSTER: string;
      PUSHER_APP_ID: string;
      PUSHER_SECRET: string;
      NEXT_PUBLIC_APP_URL: string;
    }
  }
}

export {};
