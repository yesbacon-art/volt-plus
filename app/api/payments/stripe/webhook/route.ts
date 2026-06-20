import { NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/stripe";
import { confirmTopupIntent } from "@/lib/wallet-ledger";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"));

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const topupId = session.metadata?.topupId ?? session.client_reference_id;
        if (!topupId) {
          throw new Error("Stripe session 缺少 topupId。");
        }
        await confirmTopupIntent(topupId, session.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe webhook 处理失败。" },
      { status: 400 }
    );
  }
}
