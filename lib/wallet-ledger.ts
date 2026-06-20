import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function confirmTopupIntent(topupId: string, providerRef?: string) {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.vcoinTopupIntent.findUnique({
      where: { id: topupId }
    });
    if (!intent) {
      throw new Error("充值订单不存在。");
    }
    if (intent.status === "CONFIRMED") {
      return intent;
    }

    const marked = await tx.vcoinTopupIntent.updateMany({
      where: {
        id: intent.id,
        status: {
          not: "CONFIRMED"
        }
      },
      data: {
        status: "CONFIRMED",
        providerRef: providerRef ?? intent.providerRef,
        confirmedAt: new Date()
      }
    });
    if (marked.count === 0) {
      return tx.vcoinTopupIntent.findUniqueOrThrow({ where: { id: intent.id } });
    }

    const wallet = await tx.wallet.upsert({
      where: { accountId: intent.accountId },
      update: {
        vcoinAvailable: {
          increment: intent.amountVcoin
        }
      },
      create: {
        accountId: intent.accountId,
        vcoinAvailable: intent.amountVcoin,
        vcoinReserved: 0,
        tokenBalance: 0
      }
    });

    const balanceAfter = new Prisma.Decimal(wallet.vcoinAvailable);
    await tx.walletLedgerEntry.create({
      data: {
        accountId: intent.accountId,
        type: "TOPUP",
        amountVcoin: intent.amountVcoin,
        balanceAfter,
        description: `${intent.provider} 充值确认：${intent.currency} ${intent.amountCny.toString()}`,
        referenceId: intent.id
      }
    });

    return tx.vcoinTopupIntent.findUniqueOrThrow({ where: { id: intent.id } });
  });
}
