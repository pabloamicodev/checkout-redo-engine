import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  type?: "404" | "500" | "generic";
  retryHref?: string;
  homeHref?: string;
  className?: string;
}

const defaults = {
  "404": {
    title: "Page not found",
    description: "This resource doesn't exist or you don't have access to it.",
  },
  "500": {
    title: "Server error",
    description: "Something went wrong on our end. Please try again in a moment.",
  },
  generic: {
    title: "Something went wrong",
    description: "An unexpected error occurred.",
  },
};

export function ErrorState({
  title,
  description,
  type = "generic",
  retryHref,
  homeHref,
  className,
}: ErrorStateProps) {
  const resolvedTitle = title ?? defaults[type].title;
  const resolvedDescription = description ?? defaults[type].description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
      <h3 className="text-base font-semibold text-neutral-800">{resolvedTitle}</h3>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm">{resolvedDescription}</p>
      {(retryHref || homeHref) && (
        <div className="mt-6 flex gap-3">
          {retryHref && (
            <a
              href={retryHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </a>
          )}
          {homeHref && (
            <a
              href={homeHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Go home
            </a>
          )}
        </div>
      )}
    </div>
  );
}
