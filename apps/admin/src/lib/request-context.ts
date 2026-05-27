/**
 * Request-scoped context propagated via AsyncLocalStorage.
 *
 * Set once in withShopAuth (or withRuntimeAuth) per inbound request.
 * Read anywhere (services, logger) without threading params manually.
 *
 * Node.js only — not available in Edge Runtime.
 * Safe in Vercel serverless: each invocation is a separate async chain.
 */

import { AsyncLocalStorage } from "async_hooks";

export interface RequestCtx {
  requestId: string;
  shopId?: string;
  shopDomain?: string;
}

export const requestStorage = new AsyncLocalStorage<RequestCtx>();

export function getRequestCtx(): RequestCtx | undefined {
  return requestStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestStorage.getStore()?.requestId;
}
