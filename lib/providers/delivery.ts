import { createId } from "@/lib/id";
import type { DeliveryInput, DeliveryInstruction } from "@/lib/types";

export interface DeliveryProvider {
  createInstruction(input: DeliveryInput): Promise<DeliveryInstruction>;
}

export class SandboxDeliveryProvider implements DeliveryProvider {
  async createInstruction(input: DeliveryInput): Promise<DeliveryInstruction> {
    if (!input.meterNo.trim()) {
      throw new Error("必须提供用电户号或计量点编号。");
    }
    if (input.quantityKwh <= 0) {
      throw new Error("交割电量必须大于 0 kWh。");
    }

    const now = new Date().toISOString();

    return {
      id: createId("delivery"),
      accountId: input.accountId,
      tradeId: input.tradeId,
      meterNo: input.meterNo.trim(),
      quantityKwh: input.quantityKwh,
      deliveryWindow: input.deliveryWindow,
      status: "ACCEPTED",
      provider: "sandbox-delivery",
      externalReference: createId("grid-sandbox"),
      createdAt: now,
      updatedAt: now
    };
  }
}

export function getDeliveryProvider(): DeliveryProvider {
  return new SandboxDeliveryProvider();
}
