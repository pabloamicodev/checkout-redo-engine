"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to Sentry or console in production
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-neutral-900">
            Something went wrong
          </h1>
          <p className="text-sm text-neutral-500 leading-relaxed">
            We ran into an unexpected problem loading this page.
            Your data is safe — this was a display error only.
          </p>
          {error.digest && (
            <p className="text-xs text-neutral-400 font-mono">
              Reference: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to dashboard
          </Link>
        </div>

        {/* Support hint */}
        <p className="text-xs text-neutral-400">
          If this keeps happening,{" "}
          <a
            href="mailto:support@marginlab.io"
            className="underline hover:text-neutral-600"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
