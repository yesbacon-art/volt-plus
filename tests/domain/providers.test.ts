import { afterEach, describe, expect, it } from "vitest";
import { SandboxDeliveryProvider } from "@/lib/providers/delivery";
import { SandboxRmbPaymentProvider } from "@/lib/providers/payment";
import { PolygonErc20TokenProvider } from "@/lib/providers/token";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("provider adapters", () => {
  it("creates confirmed RMB sandbox topup intents", async () => {
    const provider = new SandboxRmbPaymentProvider();

    const topup = await provider.createTopupIntent({
      accountId: "acct_test",
      amountCny: 100
    });

    expect(topup.status).toBe("CONFIRMED");
    expect(topup.amountVcoin).toBe(1000);
    expect(topup.checkoutUrl).toContain("sandbox.pay.volt.plus");
  });

  it("does not fake Polygon transfers when treasury signing is absent", async () => {
    process.env.TOKEN_SANDBOX_MODE = "false";
    process.env.TOKEN_TREASURY_PRIVATE_KEY = "";
    const provider = new PolygonErc20TokenProvider();

    const purchase = await provider.createPurchase({
      accountId: "acct_test",
      tokenAmount: 25,
      walletAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e"
    });

    expect(purchase.status).toBe("AWAITING_TREASURY");
    expect(purchase.transactionHash).toBeUndefined();
    expect(purchase.mode).toBe("READ_ONLY");
  });

  it("can create explicit sandbox Token receipts", async () => {
    process.env.TOKEN_SANDBOX_MODE = "true";
    const provider = new PolygonErc20TokenProvider();

    const purchase = await provider.createPurchase({
      accountId: "acct_test",
      tokenAmount: 25,
      walletAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e"
    });

    expect(purchase.status).toBe("SANDBOX_CONFIRMED");
    expect(purchase.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(purchase.mode).toBe("SANDBOX");
  });

  it("creates accepted sandbox delivery instructions", async () => {
    const provider = new SandboxDeliveryProvider();

    const instruction = await provider.createInstruction({
      accountId: "acct_test",
      meterNo: "HD-330106-8842",
      quantityKwh: 30,
      deliveryWindow: "2026-06-12 09:00-11:00"
    });

    expect(instruction.status).toBe("ACCEPTED");
    expect(instruction.externalReference).toContain("grid-sandbox");
  });
});
