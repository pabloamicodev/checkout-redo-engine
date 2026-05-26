import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./shopify", () => ({
  sessionStorage: {
    findSessionsByShop: vi.fn(),
  },
}));

import { getShopifyRestFetch } from "./shopify-admin-rest";
import { sessionStorage } from "./shopify";

const mockFindSessionsByShop = vi.mocked(sessionStorage!.findSessionsByShop);

describe("shopify-admin-rest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.SHOPIFY_API_VERSION = "2025-04";
    mockFindSessionsByShop.mockResolvedValue([
      {
        accessToken: "shpat_test",
      },
    ] as never);
  });

  it("throws when no session access token exists", async () => {
    mockFindSessionsByShop.mockResolvedValueOnce([] as never);
    await expect(getShopifyRestFetch("demo.myshopify.com")).rejects.toThrow(
      'No Shopify session for "demo.myshopify.com"'
    );
  });

  it("creates a typed fetch wrapper for GET requests", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ themes: [{ id: 1, name: "Live" }] }),
    });

    const rest = await getShopifyRestFetch("demo.myshopify.com");
    const res = await rest<{ themes: Array<{ id: number; name: string }> }>("/themes.json");

    expect(res.themes[0]).toEqual({ id: 1, name: "Live" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo.myshopify.com/admin/api/2025-04/themes.json",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("sends JSON body on mutating requests", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const rest = await getShopifyRestFetch("demo.myshopify.com");
    await rest("/script_tags.json", {
      method: "POST",
      body: { script_tag: { event: "onload", src: "https://cdn/app.js" } },
    });

    const call = fetchMock.mock.calls[0];
    const options = call?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.body).toContain("script_tag");
  });

  it("throws descriptive error details on non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "denied",
    });

    const rest = await getShopifyRestFetch("demo.myshopify.com");
    await expect(rest("/themes.json")).rejects.toThrow("Shopify REST GET /themes.json → 403: denied");
  });
});
