import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createTopup, getAccountId } from "@/lib/store";
import { createStripeCheckoutSession, fiatToVcoin, stripeEnabled } from "@/lib/stripe";
import { confirmTopupIntent } from "@/lib/wallet-ledger";

const topupSchema = z.object({
  amountCny: z.coerce.number().optional(),
  amountFiat: z.coerce.number().optional(),
  currency: z.string().trim().length(3).default("USD")
});

const amountSchema = z.coerce
    .number()
    .min(1, "充值金额不能低于 1。")
    .max(100_000, "单笔充值不能超过 100000。");

export async function GET() {
  return ok();
}

export async function POST(request: Request) {
  try {
    const body = topupSchema.parse(await request.json());
    const amountFiat = amountSchema.parse(body.amountFiat ?? body.amountCny);
    const currency = body.currency.toUpperCase();

    if (process.env.PAYMENT_PROVIDER === "stripe" || stripeEnabled()) {
      const account = await getCurrentAccount();
      if (!account) {
        return NextResponse.json({ error: "请先登录后再充值 V 币。" }, { status: 401 });
      }

      const amountVcoin = fiatToVcoin(amountFiat, currency);
      const topup = await prisma.vcoinTopupIntent.create({
        data: {
          accountId: account.id,
          amountCny: new Prisma.Decimal(amountFiat),
          currency,
          amountVcoin: new Prisma.Decimal(amountVcoin),
          provider: "stripe",
          status: "CREATED",
          checkoutUrl: "pending"
        }
      });

      try {
        const checkout = await createStripeCheckoutSession({
          topupId: topup.id,
          accountId: account.id,
          amountFiat,
          amountVcoin,
          currency
        });
        const updated = await prisma.vcoinTopupIntent.update({
          where: { id: topup.id },
          data: {
            checkoutUrl: checkout.url,
            providerRef: checkout.id
          }
        });
        return ok({ topup: updated });
      } catch (error) {
        await prisma.vcoinTopupIntent.update({
          where: { id: topup.id },
          data: { status: "FAILED" }
        });
        throw error;
      }
    }

    const account = await getCurrentAccount();
    if (account) {
      const amountVcoin = fiatToVcoin(amountFiat, currency);
      const topup = await prisma.vcoinTopupIntent.create({
        data: {
          accountId: account.id,
          amountCny: new Prisma.Decimal(amountFiat),
          currency,
          amountVcoin: new Prisma.Decimal(amountVcoin),
          provider: "sandbox-rmb",
          status: "CREATED",
          checkoutUrl: "sandbox://confirmed"
        }
      });
      const confirmed = await confirmTopupIntent(topup.id, "sandbox-confirmed");
      return ok({ topup: confirmed });
    }

    const topup = await createTopup({
      accountId: getAccountId(),
      amountCny: amountFiat
    });
    return ok({ topup });
  } catch (error) {
    return fail(error);
  }
}
