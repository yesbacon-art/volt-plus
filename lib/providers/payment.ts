import { createId } from "@/lib/id";
import { cnyToVcoin } from "@/lib/price";
import type { TopupInput, VcoinTopupIntent } from "@/lib/types";

export interface PaymentProvider {
  createTopupIntent(input: TopupInput): Promise<VcoinTopupIntent>;
}

export class SandboxRmbPaymentProvider implements PaymentProvider {
  async createTopupIntent(input: TopupInput): Promise<VcoinTopupIntent> {
    if (input.amountCny < 1) {
      throw new Error("充值金额不能低于 1 元。");
    }

    const now = new Date().toISOString();
    const id = createId("topup");

    return {
      id,
      accountId: input.accountId,
      amountCny: input.amountCny,
      currency: "CNY",
      amountVcoin: cnyToVcoin(input.amountCny),
      provider: "sandbox-rmb",
      status: "CONFIRMED",
      checkoutUrl: `https://sandbox.pay.volt.plus/checkout/${id}`,
      createdAt: now,
      confirmedAt: now
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new SandboxRmbPaymentProvider();
}
