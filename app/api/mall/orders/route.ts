import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentAccount } from "@/lib/auth";
import { createMallOrder, listMallOrders } from "@/lib/mall";
import { isDatabaseConfigured } from "@/lib/prisma";

const mallOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1, "请选择至少一个商品。"),
  receiverName: z.string().min(2, "请输入收货人或企业名。").max(80),
  address: z.string().min(8, "请输入完整收货或服务地址。").max(240),
  meterNo: z.string().min(4, "请输入绑定电表或服务编号。").max(80)
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ orders: [] });
    }

    const account = await requireCurrentAccount();
    const orders = await listMallOrders(account.id);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "订单读取失败。" },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "V 币商城真实下单需要先连接 PostgreSQL 数据库。" },
        { status: 503 }
      );
    }

    const account = await requireCurrentAccount();
    const body = mallOrderSchema.parse(await request.json());
    const order = await createMallOrder({
      accountId: account.id,
      ...body
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "商城下单失败。" },
      { status: 400 }
    );
  }
}
