import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Tag every event with shop context when available
  beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
    const req = hint?.originalException as { shopDomain?: string } | undefined;
    if (req?.shopDomain) {
      event.tags = { ...event.tags, shop_domain: req.shopDomain };
    }
    return event;
  },
});
