import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Target, CalendarDays, ListFilter, Zap, AlertCircle, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionShop } from "@/lib/session-shop";
import { PersonalizationActions } from "@/components/personalizations/PersonalizationActions";
import { getStatusTheme } from "@/lib/design/statusTheme";

export const metadata = { title: "Post-Purchase Personalization — MarginLab" };

const ACCENT = "#c026d3";

type TargetingRule = {
  type: string;
  operator?: string;
  value?: string | number;
};

export default async function PostPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shopDomain = await getSessionShop();

  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
  if (!shop) return notFound();

  const personalization = await prisma.personalization.findFirst({
    where: { id, shopId: shop.id, type: "POST_PURCHASE" as never },
  });
  if (!personalization) return notFound();

  const st = getStatusTheme(personalization.status);
  const isActive = personalization.status === "ACTIVE";
  const rules = (personalization.targetingRules as TargetingRule[] | null) ?? [];
  const offerIds = personalization.offerIds ?? [];

  const offers = offerIds.length > 0
    ? await prisma.offer.findMany({
        where: { id: { in: offerIds as string[] }, shopId: shop.id },
        select: { id: true, name: true, type: true, status: true },
      })
    : [];

  // Preserve the order from offerIds
  const offersById = Object.fromEntries(offers.map((o) => [o.id, o]));

  const now = new Date();
  const isScheduled = personalization.startsAt && personalization.startsAt > now;
  const isExpired = personalization.endsAt && personalization.endsAt < now;

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      {/* Gradient hero header */}
      <div
        className="px-6 pt-5 pb-5 border-b border-neutral-100"
        style={{ background: `linear-gradient(160deg, ${ACCENT}0d 0%, ${ACCENT}05 60%, #fff 100%)` }}
      >
        {/* Breadcrumb */}
        <Link
          href="/personalizations/post-purchase"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Post-Purchase
        </Link>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${ACCENT}15` }}
            >
              <Target className="w-4.5 h-4.5" style={{ color: ACCENT }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-neutral-900 leading-tight">{personalization.name}</h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0"
                  style={{ background: `${st.hex}12`, color: st.hex, borderColor: `${st.hex}25` }}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0${isActive ? " animate-pulse" : ""}`}
                    style={{ background: st.hex }}
                  />
                  {st.label}
                </span>
                {isExpired && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">
                    <AlertCircle className="w-3 h-3" /> Expired
                  </span>
                )}
                {isScheduled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                    <Clock className="w-3 h-3" /> Scheduled
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Post-Purchase
                {" · "}Priority <span className="font-semibold text-neutral-700">{personalization.priority}</span>
                {rules.length > 0 && (
                  <> · <span className="font-semibold text-neutral-700">{rules.length}</span> targeting rule{rules.length !== 1 ? "s" : ""}</>
                )}
                {offerIds.length > 0 && (
                  <> · <span className="font-semibold text-neutral-700">{offerIds.length}</span> linked offer{offerIds.length !== 1 ? "s" : ""}</>
                )}
              </p>
            </div>
          </div>
          <PersonalizationActions personalizationId={personalization.id} status={personalization.status} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Targeting Rules */}
        <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-50">
            <ListFilter className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            <h2 className="text-xs font-semibold text-neutral-700">Targeting Rules</h2>
            {rules.length === 0 && (
              <span className="ml-auto text-[10px] text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-100">
                All post-purchase visitors
              </span>
            )}
          </div>
          <div className="px-5 py-4">
            {rules.length === 0 ? (
              <p className="text-xs text-neutral-400">No rules configured — this personalization shows to all post-purchase visitors.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100 text-xs"
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: `${ACCENT}15`, color: ACCENT }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium text-neutral-700">{rule.type?.replace(/_/g, " ")}</span>
                    {rule.operator && <span className="text-neutral-400">{rule.operator}</span>}
                    {rule.value !== undefined && (
                      <span className="font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {String(rule.value)}
                      </span>
                    )}
                  </div>
                ))}
                {rules.length > 1 && (
                  <p className="text-[10px] text-neutral-400 mt-1">All rules must match (AND logic).</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Linked Offers */}
        {offerIds.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-50">
              <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <h2 className="text-xs font-semibold text-neutral-700">Linked Offers</h2>
              <span
                className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${ACCENT}10`, color: ACCENT }}
              >
                {offerIds.length} offer{offerIds.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-2">
                {(offerIds as string[]).map((offerId) => {
                  const offer = offersById[offerId];
                  return (
                    <Link
                      key={offerId}
                      href={`/offers-library/${offerId}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${ACCENT}12` }}
                        >
                          <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-800 truncate group-hover:text-neutral-900 transition-colors">
                            {offer?.name ?? offerId}
                          </p>
                          {offer && (
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {offer.type.replace(/_/g, " ")}
                              {" · "}
                              <span className={offer.status === "ACTIVE" ? "text-emerald-500" : "text-neutral-400"}>
                                {offer.status.charAt(0) + offer.status.slice(1).toLowerCase()}
                              </span>
                            </p>
                          )}
                          {!offer && (
                            <p className="text-[10px] font-mono text-neutral-300 mt-0.5">{offerId}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-400 group-hover:text-neutral-600 transition-colors shrink-0 ml-2">View →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Schedule */}
        {(personalization.startsAt || personalization.endsAt) && (
          <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-50">
              <CalendarDays className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <h2 className="text-xs font-semibold text-neutral-700">Schedule</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-6">
                {personalization.startsAt && (
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Starts</p>
                    <p className="text-sm font-medium text-neutral-800">
                      {new Date(personalization.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(personalization.startsAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
                {personalization.startsAt && personalization.endsAt && (
                  <div className="text-neutral-300 text-lg">→</div>
                )}
                {personalization.endsAt && (
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Ends</p>
                    <p className={`text-sm font-medium ${isExpired ? "text-red-500" : "text-neutral-800"}`}>
                      {new Date(personalization.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(personalization.endsAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metadata footer */}
        <div className="flex items-center justify-between px-1 text-[11px] text-neutral-400">
          <span>ID: <span className="font-mono">{personalization.id}</span></span>
          <span>Created {new Date(personalization.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>Updated {new Date(personalization.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
