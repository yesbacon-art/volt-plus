import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { createTokenPurchase, getAccountId } from "@/lib/store";

const tokenPurchaseSchema = z.object({
  tokenAmount: z.coerce
    .number()
    .positive("Token 数量必须大于 0。")
    .max(50_000, "单笔 Token 购买数量过大。"),
  walletAddress: z.string().min(1, "请输入 EVM 钱包地址。")
});

export async function GET() {
  return ok();
}

export async function POST(request: Request) {
  try {
    const body = tokenPurchaseSchema.parse(await request.json());
    const purchase = await createTokenPurchase({
      accountId: getAccountId(),
      tokenAmount: body.tokenAmount,
      walletAddress: body.walletAddress
    });
    return ok({ purchase });
  } catch (error) {
    return fail(error);
  }
}
