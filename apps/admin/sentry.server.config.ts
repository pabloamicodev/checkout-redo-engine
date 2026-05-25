import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // In dev: enabled only when DSN is explicitly set so local runs stay quiet by default.
  // In production: always enabled.
  enabled: isDev ? !!process.env.SENTRY_DSN : true,

  tracesSampleRate: isDev ? 0 : 0.1,

  beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
    const err = hint?.originalException as Record<string, unknown> | undefined;
    if (err?.shopDomain) {
      event.tags = { ...event.tags, shop_domain: String(err.shopDomain) };
    }
    return event;
  },
});
