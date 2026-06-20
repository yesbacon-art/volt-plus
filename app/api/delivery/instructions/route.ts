import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { createDelivery, getAccountId } from "@/lib/store";

const deliverySchema = z.object({
  meterNo: z.string().min(3, "请输入有效的用电户号或计量点编号。"),
  quantityKwh: z.coerce.number().positive("交割电量必须大于 0 kWh。"),
  deliveryWindow: z.string().min(6, "请输入交割窗口。"),
  tradeId: z.string().optional()
});

export async function GET() {
  return ok();
}

export async function POST(request: Request) {
  try {
    const body = deliverySchema.parse(await request.json());
    const instruction = await createDelivery({
      accountId: getAccountId(),
      ...body
    });
    return ok({ instruction });
  } catch (error) {
    return fail(error);
  }
}
