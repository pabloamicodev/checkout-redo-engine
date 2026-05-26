import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  enabled: isDev ? !!process.env.NEXT_PUBLIC_SENTRY_DSN : true,

  tracesSampleRate: isDev ? 0 : 0.1,

  // Session replay: only in production
  replaysSessionSampleRate: isDev ? 0 : 0.01,
  replaysOnErrorSampleRate: isDev ? 0 : 1.0,

  integrations: isDev
    ? []
    : [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
