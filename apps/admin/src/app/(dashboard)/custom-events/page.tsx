"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

interface CustomEvent {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  createdAt: string;
}

type StatusMsg = { type: "success" | "error"; text: string } | null;

export default function CustomEventsPage() {
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<StatusMsg>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState("");

  // Snippet expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showStatus = (msg: StatusMsg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-events");
      if (res.ok) {
        const data = await res.json() as { events: CustomEvent[] };
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const validateName = (n: string) => {
    if (!n) return "Name is required";
    if (!/^[a-z0-9_]+$/.test(n)) return "Only lowercase letters, numbers, underscores";
    if (n.length > 80) return "Max 80 characters";
    return "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setNameError(err);
      return;
    }
    if (!displayName.trim()) {
      showStatus({ type: "error", text: "Display name is required" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/custom-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), displayName: displayName.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json() as { error?: string | Record<string, unknown> };
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Failed to create";
        showStatus({ type: "error", text: errMsg });
        return;
      }
      showStatus({ type: "success", text: `"${name}" created` });
      setName("");
      setDisplayName("");
      setDescription("");
      setShowCreate(false);
      fetchEvents();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (event: CustomEvent) => {
    if (!confirm(`Delete "${event.displayName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/custom-events/${event.id}`, { method: "DELETE" });
    if (res.ok) {
      showStatus({ type: "success", text: `"${event.displayName}" deleted` });
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    }
  };

  const snippet = (eventName: string) =>
    `// Track from any page on your storefront
window.MarginLab?.track("${eventName}", {
  // add your custom payload here
  value: 42,
});

// Or use the async onReady callback
window.MarginLab?.onReady(function(ml) {
  ml.track("${eventName}", { value: 42 });
});`;

  const copySnippet = async (id: string, eventName: string) => {
    await navigator.clipboard.writeText(snippet(eventName));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Custom Events</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Register events tracked by your storefront and Pixel extension</p>
        </div>

        <div className="space-y-6">
        {/* Status */}
        {statusMsg && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
              statusMsg.type === "success"
                ? "bg-success-50 border border-success-200 text-success-800"
                : "bg-danger-50 border border-danger-200 text-danger-800"
            }`}
          >
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* How it works */}
        <Card className="bg-brand-50 border-brand-100">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-brand-900 mb-1">How custom events work</p>
              <p className="text-brand-700 text-xs leading-relaxed">
                Register events here, then fire them from your storefront using{" "}
                <code className="font-mono bg-brand-100 px-1 rounded">
                  window.MarginLab.track("event_name", payload)
                </code>
                . Registered events appear in experiment goal selectors and analytics.
                Unregistered events are still ingested but won&apos;t appear as goals.
              </p>
            </div>
          </div>
        </Card>

        {/* Create form */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New custom event
          </button>
        </div>

        {showCreate && (
          <Card>
            <form onSubmit={handleCreate} className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900">New custom event</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                    Event name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                      setNameError(validateName(e.target.value));
                    }}
                    placeholder="quiz_completed"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono ${
                      nameError ? "border-danger-300" : "border-neutral-200"
                    }`}
                  />
                  {nameError && (
                    <p className="text-xs text-danger-600 mt-1">{nameError}</p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    Lowercase, alphanumeric + underscores. This is the key used in{" "}
                    <code className="font-mono">track()</code>.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                    Display name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Quiz Completed"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Fired when a visitor completes the product recommendation quiz"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !!nameError}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating…" : "Create event"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Events list */}
        <Card padding="none">
          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400 animate-pulse">
              Loading…
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center">
              <Zap className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No custom events yet</p>
              <p className="text-xs text-neutral-400 mt-1">
                Create one to start tracking custom conversion signals
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {events.map((event) => {
                const isExpanded = expandedId === event.id;
                const isCopied = copiedId === event.id;
                return (
                  <div key={event.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono font-semibold text-neutral-900">
                            {event.name}
                          </code>
                          <span className="text-xs text-neutral-400">·</span>
                          <span className="text-sm text-neutral-600">{event.displayName}</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-neutral-500 mt-1">{event.description}</p>
                        )}
                        <p className="text-xs text-neutral-400 mt-1">
                          Added {new Date(event.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          Snippet
                        </button>
                        <button
                          onClick={() => handleDelete(event)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 bg-neutral-900 rounded-xl p-4 relative">
                        <button
                          onClick={() => copySnippet(event.id, event.name)}
                          className="absolute top-3 right-3 p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                          title="Copy snippet"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-success-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {snippet(event.name)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}
