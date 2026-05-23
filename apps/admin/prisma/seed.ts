import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  // Demo shop
  const shop = await prisma.shop.upsert({
    where: { shopDomain: "demo.myshopify.com" },
    update: {},
    create: {
      shopDomain: "demo.myshopify.com",
      accessTokenEncrypted: "demo-token",
      scopes: ["read_products", "write_products", "read_orders"],
      timezone: "America/New_York",
      currencyCode: "USD",
      planName: "Shopify Plus",
      settings: {},
    },
  });
  console.log("Shop created:", shop.shopDomain);

  // Demo experiments
  const priceTest = await prisma.experiment.upsert({
    where: { shopId_slug: { shopId: shop.id, slug: "summer-price-test" } },
    update: {},
    create: {
      shopId: shop.id,
      name: "Summer Collection Price Test",
      slug: "summer-price-test",
      description: "Testing 10% price increase on summer items",
      hypothesis: "Higher prices will increase revenue without hurting conversion",
      type: "PRICE_TEST",
      status: "RUNNING",
      primaryMetric: "revenue_per_visitor",
      trafficAllocation: 100,
      launchedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      variants: {
        create: [
          {
            shopId: shop.id,
            key: "control",
            name: "Control (Current Prices)",
            isControl: true,
            allocationPercent: 50,
          },
          {
            shopId: shop.id,
            key: "variant_a",
            name: "+10% Price",
            isControl: false,
            allocationPercent: 50,
          },
        ],
      },
    },
    include: { variants: true },
  });

  const discountTest = await prisma.experiment.upsert({
    where: { shopId_slug: { shopId: shop.id, slug: "free-shipping-threshold" } },
    update: {},
    create: {
      shopId: shop.id,
      name: "Free Shipping Threshold Test",
      slug: "free-shipping-threshold",
      description: "Test $50 vs $75 free shipping threshold",
      type: "DISCOUNT_TEST",
      status: "RUNNING",
      primaryMetric: "conversion_rate",
      trafficAllocation: 100,
      launchedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      variants: {
        create: [
          {
            shopId: shop.id,
            key: "control",
            name: "Free shipping at $75",
            isControl: true,
            allocationPercent: 50,
          },
          {
            shopId: shop.id,
            key: "variant_a",
            name: "Free shipping at $50",
            isControl: false,
            allocationPercent: 50,
          },
        ],
      },
    },
    include: { variants: true },
  });

  const draftTest = await prisma.experiment.upsert({
    where: { shopId_slug: { shopId: shop.id, slug: "checkout-upsell-test" } },
    update: {},
    create: {
      shopId: shop.id,
      name: "Checkout Upsell Block Test",
      slug: "checkout-upsell-test",
      type: "CHECKOUT_TEST",
      status: "DRAFT",
      primaryMetric: "aov",
      trafficAllocation: 50,
      variants: {
        create: [
          {
            shopId: shop.id,
            key: "control",
            name: "No upsell",
            isControl: true,
            allocationPercent: 50,
          },
          {
            shopId: shop.id,
            key: "variant_a",
            name: "Product upsell block",
            isControl: false,
            allocationPercent: 50,
          },
        ],
      },
    },
  });

  // Daily metrics for the price test (last 7 days)
  const variants = priceTest.variants;
  const control = variants.find((v) => v.isControl)!;
  const variantA = variants.find((v) => !v.isControl)!;

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await prisma.dailyMetric.upsert({
      where: { shopId_experimentId_variantId_date: { shopId: shop.id, experimentId: priceTest.id, variantId: control.id, date } },
      update: {},
      create: {
        shopId: shop.id,
        experimentId: priceTest.id,
        variantId: control.id,
        date,
        visitors: 420 + Math.floor(Math.random() * 80),
        sessions: 480 + Math.floor(Math.random() * 80),
        pageViews: 1200 + Math.floor(Math.random() * 200),
        addToCarts: 95 + Math.floor(Math.random() * 20),
        checkoutsStarted: 68 + Math.floor(Math.random() * 15),
        orders: 42 + Math.floor(Math.random() * 10),
        revenue: 3800 + Math.random() * 600,
        netRevenue: 3600 + Math.random() * 600,
        discounts: 120 + Math.random() * 50,
        shippingRevenue: 280 + Math.random() * 60,
        cogs: 1400 + Math.random() * 200,
        grossProfit: 2200 + Math.random() * 400,
        conversionRate: 0.092,
        aov: 88,
        revenuePerVisitor: 8.1,
        profitPerVisitor: 4.9,
      },
    });

    await prisma.dailyMetric.upsert({
      where: { shopId_experimentId_variantId_date: { shopId: shop.id, experimentId: priceTest.id, variantId: variantA.id, date } },
      update: {},
      create: {
        shopId: shop.id,
        experimentId: priceTest.id,
        variantId: variantA.id,
        date,
        visitors: 415 + Math.floor(Math.random() * 80),
        sessions: 470 + Math.floor(Math.random() * 80),
        pageViews: 1180 + Math.floor(Math.random() * 200),
        addToCarts: 88 + Math.floor(Math.random() * 20),
        checkoutsStarted: 65 + Math.floor(Math.random() * 15),
        orders: 40 + Math.floor(Math.random() * 10),
        revenue: 4200 + Math.random() * 700,
        netRevenue: 3980 + Math.random() * 700,
        discounts: 100 + Math.random() * 40,
        shippingRevenue: 290 + Math.random() * 60,
        cogs: 1380 + Math.random() * 200,
        grossProfit: 2600 + Math.random() * 400,
        conversionRate: 0.088,
        aov: 97,
        revenuePerVisitor: 9.1,
        profitPerVisitor: 5.9,
      },
    });
  }

  // Demo offer
  await prisma.offer.upsert({
    where: { id: "demo-offer-1" },
    update: {},
    create: {
      id: "demo-offer-1",
      shopId: shop.id,
      name: "Buy 2 Get 1 Free — Accessories",
      type: "BUY_X_GET_Y",
      status: "ACTIVE",
      triggerRules: [{ type: "product_tag", value: "accessories" }],
      discountRules: { buy: 2, get: 1, discountPercent: 100 },
      displaySettings: { position: "cart", title: "Buy 2 Get 1 Free!" },
    },
  });

  // Demo checkout block
  await prisma.checkoutBlock.upsert({
    where: { id: "demo-block-1" },
    update: {},
    create: {
      id: "demo-block-1",
      shopId: shop.id,
      name: "Trust Badges — Secure Checkout",
      type: "TRUST_BADGES",
      status: "ACTIVE",
      content: { badges: ["ssl", "money_back", "free_returns"] },
      styles: { layout: "horizontal" },
      position: "AFTER_CONTACT",
    },
  });

  // Demo custom event
  await prisma.customEvent.upsert({
    where: { shopId_name: { shopId: shop.id, name: "quiz_completed" } },
    update: {},
    create: {
      shopId: shop.id,
      name: "quiz_completed",
      displayName: "Quiz Completed",
      description: "Fired when a visitor completes the product recommendation quiz",
      schema: { result: "string", score: "number" },
    },
  });

  console.log("Seed complete.");
  console.log(`  Shop: ${shop.shopDomain}`);
  console.log(`  Experiments: ${[priceTest.name, discountTest.name, draftTest.name].join(", ")}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
