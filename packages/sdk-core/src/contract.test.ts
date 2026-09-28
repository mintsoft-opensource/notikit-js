import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { NotikitClient } from "./index";

/**
 * SDK ↔ 실제 서버 계약 검증. 서버 저장소의 e2e 에 있던 것을 SDK 쪽으로 옮겼다 —
 * 서버가 API 를 바꿨을 때 깨져야 하는 쪽은 SDK 다.
 *
 * 서버가 떠 있을 때만 돈다:
 *   NOTIKIT_CONTRACT_URL=http://localhost:3000 NOTIKIT_CONTRACT_ADMIN_TOKEN=... pnpm test
 */
const BASE = process.env.NOTIKIT_CONTRACT_URL;
const ADMIN = process.env.NOTIKIT_CONTRACT_ADMIN_TOKEN;

describe.skipIf(!BASE || !ADMIN)("SDK ↔ live API contract", () => {
  it("registers, identifies, subscribes and sends against a real server", async () => {
    const created = await fetch(`${BASE}/api/admin/projects`, {
      method: "POST",
      headers: { "x-admin-token": ADMIN!, "content-type": "application/json" },
      body: JSON.stringify({ name: `sdk-contract-${Date.now()}`, environment: "dev" }),
    });
    expect(created.status).toBe(201);
    const cj = await created.json();
    const apiKey = cj.data.project.apiKey as string;
    const apiSecret = cj.data.api_secret as string;
    const userId = "sdk-contract-user";
    const identityHash = createHmac("sha256", apiSecret).update(userId).digest("hex");
    const token = `sdk-contract-tok-${Date.now()}`;

    const client = new NotikitClient({ baseUrl: BASE!, apiKey });
    expect(await client.registerDevice({ token, platform: "web", externalId: userId, identityHash })).toHaveProperty("device");
    expect(await client.identify({ externalId: userId, identityHash, attributes: { plan: "pro" } })).toHaveProperty("user");
    expect((await client.subscribe("news", token)).subscribed).toBe(true);

    const server = new NotikitClient({ baseUrl: BASE!, apiKey, apiSecret });
    expect(await server.send({ title: "SDK", body: "contract", type: "single", target: userId })).toHaveProperty("message");
  });

  it("rejects an unknown api key with an error", async () => {
    const client = new NotikitClient({ baseUrl: BASE!, apiKey: "nk_invalid" });
    await expect(client.identify({ externalId: "x" })).rejects.toThrow();
  });
});
