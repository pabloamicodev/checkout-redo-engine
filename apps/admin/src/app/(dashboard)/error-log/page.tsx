import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: "error" | "warning" | "info" | "debug" | "fatal";
  status: "resolved" | "unresolved" | "ignored";
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  metadata: { value?: string; filename?: string };
}

const LEVEL_STYLES: Record<string, string> = {
  fatal:   "bg-red-100 text-red-700",
  error:   "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-600",
  info:    "bg-blue-50 text-blue-600",
  debug:   "bg-neutral-100 text-neutral-500",
};

async function getSentryIssues(level?: string): Promise<SentryIssue[]> {
  const token   = process.env.SENTRY_AUTH_TOKEN;
  const org     = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!token || !org || !project) return [];

  const query = ["is:unresolved", level ? `level:${level}` : ""].filter(Boolean).join(" ");
  const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?limit=50&query=${encodeURIComponent(query)}&sort=date`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<SentryIssue[]>;
  } catch {
    return [];
  }
}

export default async function ErrorLogPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const issues = await getSentryIssues(level);

  const org     = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const sentryUrl = org && project
    ? `https://sentry.io/organizations/${org}/issues/?project=${project}`
    : "https://sentry.io";

  const notConfigured = !process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Error Log</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {notConfigured ? "Sentry not configured" : `${issues.length} unresolved issues`}
            </p>
          </div>
          <a
            href={sentryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-600"
          >
            Open in Sentry
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {notConfigured ? (
          <div className="bg-white rounded-xl border border-neutral-200 py-16 text-center">
            <ShieldAlert className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700 mb-1">Sentry not configured</p>
            <p className="text-xs text-neutral-400">
              Set <code className="font-mono bg-neutral-100 px-1 rounded">SENTRY_AUTH_TOKEN</code> and{" "}
              <code className="font-mono bg-neutral-100 px-1 rounded">SENTRY_ORG</code> in your environment.
            </p>
          </div>
        ) : (
          <>
            {/* Level filters */}
            <div className="flex items-center gap-1 mb-4">
              {[undefined, "fatal", "error", "warning", "info"].map((l) => (
                <Link
                  key={l ?? "all"}
                  href={l ? `/error-log?level=${l}` : "/error-log"}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                    (l ?? undefined) === (level ?? undefined)
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                  }`}
                >
                  {l ?? "All"}
                </Link>
              ))}
            </div>

            {issues.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 py-16 text-center">
                <AlertTriangle className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-700 mb-1">No issues found</p>
                <p className="text-xs text-neutral-400">No unresolved {level ?? ""} errors in Sentry.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50">
                      <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400">Issue</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 w-20">Level</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 w-16">Events</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 w-16">Users</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 w-32">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue) => (
                      <tr
                        key={issue.id}
                        className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors group"
                      >
                        <td className="px-5 py-3.5">
                          <a
                            href={issue.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <p className="text-sm text-neutral-800 font-medium truncate max-w-md group-hover:text-brand-600 transition-colors">
                              {issue.title}
                            </p>
                            {(issue.metadata.value ?? issue.culprit) && (
                              <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-md font-mono">
                                {issue.metadata.value ?? issue.culprit}
                              </p>
                            )}
                          </a>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                              LEVEL_STYLES[issue.level] ?? LEVEL_STYLES.debug
                            }`}
                          >
                            {issue.level}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-neutral-600 font-medium">
                          {Number(issue.count).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-neutral-500">
                          {issue.userCount > 0 ? issue.userCount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-neutral-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(issue.lastSeen), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
