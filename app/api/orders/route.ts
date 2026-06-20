import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { cancelExistingOrder, getAccountId, submitOrder } from "@/lib/store";

const orderSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  quantityKwh: z.coerce.number().positive("交易电量必须大于 0 kWh。"),
  limitPriceCnyKwh: z.coerce.number().positive("限价必须大于 0 元/kWh。")
});

export async function GET() {
  return ok();
}

export async function POST(request: Request) {
  try {
    const body = orderSchema.parse(await request.json());
    const result = submitOrder({
      accountId: getAccountId(),
      ...body
    });
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(await request.json());
    const order = cancelExistingOrder(orderId);
    return ok({ order });
  } catch (error) {
    return fail(error);
  }
}
