import { prisma } from "@/lib/prisma";
import { IntegrationService } from "@/services/integration.service";
import { IntegrationsClient } from "@/components/integrations/IntegrationsClient";
import { getSessionShop } from "@/lib/session-shop";


export const dynamic = 'force-dynamic';
const service = new IntegrationService();

export const metadata = { title: "Integrations — MarginLab" };

export default async function IntegrationsPage() {
  const shopDomain = await getSessionShop();
  const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });

  const integrations = shop ? await service.list(shop.id) : [];

  return (
    <div className="flex-1 overflow-auto bg-neutral-50">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Integrations</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Connect MarginLab to your analytics and marketing tools. Credentials are stored encrypted.
          </p>
        </div>
        <IntegrationsClient initialIntegrations={integrations as never} />
      </div>
    </div>
  );
}
