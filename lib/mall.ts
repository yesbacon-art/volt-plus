import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_MALL_PRODUCTS = [
  {
    slug: "home-battery-5kwh",
    name: "家庭储能电池",
    category: "硬件设备",
    description: "5kWh 模块化储能，支持峰谷套利、停电应急和余电回售策略。",
    priceVcoin: 32800,
    stock: 12,
    specs: ["5kWh", "三年质保", "上门安装"]
  },
  {
    slug: "smart-ev-charger",
    name: "智能充电桩",
    category: "硬件设备",
    description: "自动选择低价时段充电，接入 VOLT+ AI 电价预测。",
    priceVcoin: 18600,
    stock: 18,
    specs: ["7kW", "低价充电", "远程控制"]
  },
  {
    slug: "energy-router",
    name: "家庭能源路由器",
    category: "智能网关",
    description: "统一管理光伏、储能、充电桩和电表数据，生成家庭能源账单。",
    priceVcoin: 8900,
    stock: 24,
    specs: ["多设备接入", "实时监测", "策略联动"]
  },
  {
    slug: "solar-maintenance",
    name: "光伏运维套餐",
    category: "能源服务",
    description: "屋顶光伏巡检、清洁、发电效率分析和余电回售建议。",
    priceVcoin: 6800,
    stock: 42,
    specs: ["年度服务", "效率报告", "回售建议"]
  },
  {
    slug: "green-energy-card",
    name: "绿电权益卡",
    category: "权益凭证",
    description: "兑换家庭绿电权益和碳减排凭证展示服务。",
    priceVcoin: 2400,
    stock: 100,
    specs: ["权益记录", "低碳证明", "可展示"]
  },
  {
    slug: "ai-energy-pass",
    name: "AI 能源管家年卡",
    category: "AI 服务",
    description: "一年 AI 用电优化、峰谷提醒、储能调度和设备健康建议。",
    priceVcoin: 3600,
    stock: 80,
    specs: ["12个月", "AI预测", "节费建议"]
  }
] as const;

export type CreateMallOrderInput = {
  accountId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  receiverName: string;
  address: string;
  meterNo: string;
};

export async function ensureMallProducts() {
  const count = await prisma.mallProduct.count();
  if (count > 0) return;

  await prisma.mallProduct.createMany({
    data: DEFAULT_MALL_PRODUCTS.map((product) => ({
      ...product,
      priceVcoin: new Prisma.Decimal(product.priceVcoin),
      specs: [...product.specs]
    }))
  });
}

export async function listMallProducts() {
  await ensureMallProducts();
  return prisma.mallProduct.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { priceVcoin: "desc" }]
  });
}

export async function listMallOrders(accountId: string) {
  return prisma.mallOrder.findMany({
    where: { accountId },
    include: {
      items: true
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });
}

export async function createMallOrder(input: CreateMallOrderInput) {
  const normalizedItems = input.items
    .map((item) => ({
      productId: item.productId,
      quantity: Math.floor(item.quantity)
    }))
    .filter((item) => item.quantity > 0);

  if (normalizedItems.length === 0) {
    throw new Error("请选择至少一个商品。");
  }

  return prisma.$transaction(async (tx) => {
    const products = await tx.mallProduct.findMany({
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId)
        },
        active: true
      }
    });

    if (products.length !== normalizedItems.length) {
      throw new Error("部分商品不存在或已下架。");
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const orderItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new Error("商品不存在。");
      }
      if (item.quantity > product.stock) {
        throw new Error(`${product.name} 库存不足。`);
      }
      const unitPrice = new Prisma.Decimal(product.priceVcoin);
      const total = unitPrice.mul(item.quantity);
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        total
      };
    });

    const totalVcoin = orderItems.reduce(
      (sum, item) => sum.plus(item.total),
      new Prisma.Decimal(0)
    );

    const walletUpdate = await tx.wallet.updateMany({
      where: {
        accountId: input.accountId,
        vcoinAvailable: {
          gte: totalVcoin
        }
      },
      data: {
        vcoinAvailable: {
          decrement: totalVcoin
        }
      }
    });

    if (walletUpdate.count === 0) {
      throw new Error("V 币余额不足。");
    }

    for (const item of orderItems) {
      const stockUpdate = await tx.mallProduct.updateMany({
        where: {
          id: item.product.id,
          stock: {
            gte: item.quantity
          }
        },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });
      if (stockUpdate.count === 0) {
        throw new Error(`${item.product.name} 库存不足。`);
      }
    }

    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { accountId: input.accountId }
    });

    const order = await tx.mallOrder.create({
      data: {
        accountId: input.accountId,
        status: "PAID",
        totalVcoin,
        receiverName: input.receiverName,
        address: input.address,
        meterNo: input.meterNo,
        items: {
          create: orderItems.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            unitPriceVcoin: item.unitPrice,
            quantity: item.quantity,
            totalVcoin: item.total
          }))
        }
      },
      include: {
        items: true
      }
    });

    await tx.walletLedgerEntry.create({
      data: {
        accountId: input.accountId,
        type: "MALL_PURCHASE",
        amountVcoin: totalVcoin.neg(),
        balanceAfter: wallet.vcoinAvailable,
        description: `V 币商城订单 ${order.id}`,
        referenceId: order.id
      }
    });

    return order;
  });
}
