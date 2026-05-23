/**
 * EmailService
 *
 * Sends transactional emails via Resend.
 * All sends are fire-and-forget from the caller's perspective — errors are
 * logged but never thrown so that email failures never break core flows.
 *
 * GUARD: No-ops if RESEND_API_KEY is not set (dev mode).
 * GUARD: All templates are plain-text safe (no HTML-only content).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "MarginLab <no-reply@marginlab.app>";
const APP_URL = process.env.HOST ?? "https://app.marginlab.io";

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(opts: SendOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    console.info("[Email] RESEND_API_KEY not set — skipping send to", opts.to);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Resend API error:", err);
    }
  } catch (err) {
    console.error("[Email] Send failed:", err);
  }
}

export class EmailService {
  /**
   * Notify the shop owner that a statistical winner has been detected.
   */
  async sendWinnerDetected(opts: {
    to: string;
    shopDomain: string;
    experimentName: string;
    experimentId: string;
    winnerVariantName: string;
    conversionLift: number;
    confidence: number;
  }): Promise<void> {
    const liftPct = (opts.conversionLift * 100).toFixed(1);
    const confPct = (opts.confidence * 100).toFixed(0);
    const url = `${APP_URL}/experiments/${opts.experimentId}`;

    await send({
      to: opts.to,
      subject: `🎉 Winner found in "${opts.experimentName}"`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#111827;margin-bottom:8px">Statistical winner detected</h2>
          <p style="color:#6b7280;margin-bottom:24px">${opts.shopDomain}</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0 0 4px;font-weight:600;color:#166534">Experiment: ${opts.experimentName}</p>
            <p style="margin:0 0 4px;color:#15803d">Winner: ${opts.winnerVariantName}</p>
            <p style="margin:0;color:#15803d">+${liftPct}% conversion lift · ${confPct}% confidence</p>
          </div>
          <a href="${url}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            View Results
          </a>
        </div>
      `,
      text: `Winner detected in "${opts.experimentName}"\n\nVariant: ${opts.winnerVariantName}\nLift: +${liftPct}%\nConfidence: ${confPct}%\n\nView: ${url}`,
    });
  }

  /**
   * Weekly digest of experiment performance.
   */
  async sendWeeklyDigest(opts: {
    to: string;
    shopDomain: string;
    weekStart: string;
    weekEnd: string;
    experiments: Array<{
      name: string;
      id: string;
      status: string;
      visitors: number;
      orders: number;
      topVariant?: string;
      lift?: number;
    }>;
    totalRevenue: number;
    currency: string;
  }): Promise<void> {
    const rows = opts.experiments
      .map(
        (e) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${e.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${e.visitors.toLocaleString()}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${e.orders.toLocaleString()}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:${e.lift && e.lift > 0 ? "#166534" : "#6b7280"}">${e.lift ? `+${(e.lift * 100).toFixed(1)}%` : "—"}</td>
          </tr>`
      )
      .join("");

    await send({
      to: opts.to,
      subject: `MarginLab Weekly Digest — ${opts.weekStart}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#111827">Weekly Digest</h2>
          <p style="color:#6b7280">${opts.shopDomain} · ${opts.weekStart} – ${opts.weekEnd}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280">Experiment</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">Visitors</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">Orders</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">Best Lift</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <a href="${APP_URL}" style="display:inline-block;margin-top:24px;background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">
            Open Dashboard
          </a>
        </div>
      `,
      text: `MarginLab Weekly Digest\n${opts.shopDomain}\n${opts.weekStart}–${opts.weekEnd}\n\n${opts.experiments.map((e) => `${e.name}: ${e.visitors} visitors, ${e.orders} orders`).join("\n")}\n\n${APP_URL}`,
    });
  }

  /**
   * Alert when an experiment has been running for 14+ days with no significant result.
   */
  async sendInconclusive(opts: {
    to: string;
    experimentName: string;
    experimentId: string;
    daysRunning: number;
  }): Promise<void> {
    const url = `${APP_URL}/experiments/${opts.experimentId}`;
    await send({
      to: opts.to,
      subject: `Experiment "${opts.experimentName}" — no winner after ${opts.daysRunning} days`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#111827">Still inconclusive after ${opts.daysRunning} days</h2>
          <p style="color:#6b7280">Your experiment <strong>${opts.experimentName}</strong> hasn't reached statistical significance yet.</p>
          <p style="color:#6b7280">Consider running it longer, increasing traffic allocation, or adjusting the variants to create a bigger difference.</p>
          <a href="${url}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">
            View Experiment
          </a>
        </div>
      `,
      text: `"${opts.experimentName}" has been running ${opts.daysRunning} days with no statistical winner.\n\n${url}`,
    });
  }
}
