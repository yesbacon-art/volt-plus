import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient();

async function main() {
  const account = await prisma.account.upsert({
    where: { email: "demo@volt.plus" },
    update: {},
    create: {
      email: "demo@volt.plus",
      phone: "+8613800000000",
      displayName: "伏特家演示账户",
      passwordHash: hashPassword("Voltplus123"),
      wallet: {
        create: {
          vcoinAvailable: 12800,
          vcoinReserved: 0,
          tokenBalance: 0
        }
      },
      ledgerEntries: {
        create: {
          type: "TOPUP",
          amountVcoin: 12800,
          balanceAfter: 12800,
          description: "演示账户初始 V 币额度",
          referenceId: "seed_balance"
        }
      }
    }
  });

  await prisma.marketOrder.createMany({
    data: [
      {
        accountId: account.id,
        side: "BUY",
        quantityKwh: 80,
        remainingKwh: 80,
        limitPriceCnyKwh: 0.688,
        status: "OPEN"
      },
      {
        accountId: account.id,
        side: "SELL",
        quantityKwh: 45,
        remainingKwh: 45,
        limitPriceCnyKwh: 0.756,
        status: "OPEN"
      }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
