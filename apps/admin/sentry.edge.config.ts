import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: isDev ? !!process.env.SENTRY_DSN : true,
  tracesSampleRate: isDev ? 0 : 0.05,
});
