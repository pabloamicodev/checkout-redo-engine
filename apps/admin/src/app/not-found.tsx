import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center">
          <Search className="w-7 h-7 text-neutral-400" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">404</p>
          <h1 className="text-xl font-semibold text-neutral-900">Page not found</h1>
          <p className="text-sm text-neutral-500 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to dashboard
          </Link>
        </div>

        <p className="text-xs text-neutral-400">
          Need help?{" "}
          <a href="mailto:support@marginlab.io" className="underline hover:text-neutral-600">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
