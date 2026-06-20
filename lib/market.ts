import { createId } from "@/lib/id";
import { cnyToVcoin, round, vcoinForPower } from "@/lib/price";
import type {
  MarketOrder,
  OrderBookLevel,
  PlaceOrderInput,
  Trade,
  Wallet,
  WalletLedgerEntry
} from "@/lib/types";

type MarketState = {
  wallet: Wallet;
  orders: MarketOrder[];
  trades: Trade[];
  ledger: WalletLedgerEntry[];
};

export function createLedgerEntry(
  wallet: Wallet,
  entry: Omit<WalletLedgerEntry, "id" | "accountId" | "balanceAfter" | "createdAt">
): WalletLedgerEntry {
  return {
    id: createId("ledger"),
    accountId: wallet.accountId,
    balanceAfter: round(wallet.vcoinAvailable, 2),
    createdAt: new Date().toISOString(),
    ...entry
  };
}

export function applyTopup(
  wallet: Wallet,
  ledger: WalletLedgerEntry[],
  amountCny: number,
  referenceId: string
) {
  const amountVcoin = cnyToVcoin(amountCny);
  wallet.vcoinAvailable = round(wallet.vcoinAvailable + amountVcoin, 2);
  ledger.unshift(
    createLedgerEntry(wallet, {
      type: "TOPUP",
      amountVcoin,
      description: `人民币沙盒充值 ${amountCny.toFixed(2)} 元`,
      referenceId
    })
  );
  return amountVcoin;
}

export function reserveForBuyOrder(
  wallet: Wallet,
  ledger: WalletLedgerEntry[],
  quantityKwh: number,
  limitPriceCnyKwh: number,
  referenceId: string
) {
  const reserveVcoin = vcoinForPower(quantityKwh, limitPriceCnyKwh);
  if (wallet.vcoinAvailable < reserveVcoin) {
    throw new Error("V 币余额不足，无法冻结买单资金。");
  }

  wallet.vcoinAvailable = round(wallet.vcoinAvailable - reserveVcoin, 2);
  wallet.vcoinReserved = round(wallet.vcoinReserved + reserveVcoin, 2);
  ledger.unshift(
    createLedgerEntry(wallet, {
      type: "ORDER_RESERVE",
      amountVcoin: -reserveVcoin,
      description: `冻结买电资金 ${reserveVcoin.toFixed(2)} V 币`,
      referenceId
    })
  );

  return reserveVcoin;
}

export function placeOrder(state: MarketState, input: PlaceOrderInput) {
  if (input.quantityKwh <= 0) {
    throw new Error("交易电量必须大于 0 kWh。");
  }
  if (input.limitPriceCnyKwh <= 0) {
    throw new Error("限价必须大于 0 元/kWh。");
  }

  const order: MarketOrder = {
    id: createId("order"),
    accountId: input.accountId,
    side: input.side,
    quantityKwh: round(input.quantityKwh, 2),
    remainingKwh: round(input.quantityKwh, 2),
    limitPriceCnyKwh: round(input.limitPriceCnyKwh, 3),
    status: "OPEN",
    createdAt: new Date().toISOString()
  };

  if (order.side === "BUY") {
    reserveForBuyOrder(
      state.wallet,
      state.ledger,
      order.quantityKwh,
      order.limitPriceCnyKwh,
      order.id
    );
  }

  const contra = state.orders
    .filter((candidate) => {
      if (candidate.status !== "OPEN" || candidate.side === order.side) return false;
      if (order.side === "BUY") return candidate.limitPriceCnyKwh <= order.limitPriceCnyKwh;
      return candidate.limitPriceCnyKwh >= order.limitPriceCnyKwh;
    })
    .sort((a, b) =>
      order.side === "BUY"
        ? a.limitPriceCnyKwh - b.limitPriceCnyKwh
        : b.limitPriceCnyKwh - a.limitPriceCnyKwh
    );

  const trades: Trade[] = [];

  for (const matched of contra) {
    if (order.remainingKwh <= 0) break;
    const quantityKwh = round(Math.min(order.remainingKwh, matched.remainingKwh), 2);
    const priceCnyKwh = matched.limitPriceCnyKwh;
    const notionalVcoin = vcoinForPower(quantityKwh, priceCnyKwh);

    order.remainingKwh = round(order.remainingKwh - quantityKwh, 2);
    matched.remainingKwh = round(matched.remainingKwh - quantityKwh, 2);
    matched.status = matched.remainingKwh === 0 ? "FILLED" : "PARTIALLY_FILLED";

    if (order.side === "BUY") {
      state.wallet.vcoinReserved = round(state.wallet.vcoinReserved - notionalVcoin, 2);
      const reservedAtLimit = vcoinForPower(quantityKwh, order.limitPriceCnyKwh);
      const release = round(reservedAtLimit - notionalVcoin, 2);
      if (release > 0) {
        state.wallet.vcoinReserved = round(state.wallet.vcoinReserved - release, 2);
        state.wallet.vcoinAvailable = round(state.wallet.vcoinAvailable + release, 2);
        state.ledger.unshift(
          createLedgerEntry(state.wallet, {
            type: "ORDER_RELEASE",
            amountVcoin: release,
            description: `释放优价成交差额 ${release.toFixed(2)} V 币`,
            referenceId: order.id
          })
        );
      }
      state.ledger.unshift(
        createLedgerEntry(state.wallet, {
          type: "POWER_BUY",
          amountVcoin: -notionalVcoin,
          description: `买入 ${quantityKwh.toFixed(2)} kWh 电力`,
          referenceId: order.id
        })
      );
    } else {
      state.wallet.vcoinAvailable = round(state.wallet.vcoinAvailable + notionalVcoin, 2);
      state.ledger.unshift(
        createLedgerEntry(state.wallet, {
          type: "POWER_SELL",
          amountVcoin: notionalVcoin,
          description: `卖出 ${quantityKwh.toFixed(2)} kWh 电力`,
          referenceId: order.id
        })
      );
    }

    const trade: Trade = {
      id: createId("trade"),
      buyOrderId: order.side === "BUY" ? order.id : matched.id,
      sellOrderId: order.side === "SELL" ? order.id : matched.id,
      quantityKwh,
      priceCnyKwh,
      notionalVcoin,
      createdAt: new Date().toISOString()
    };
    trades.push(trade);
    state.trades.unshift(trade);
  }

  order.status =
    order.remainingKwh === 0
      ? "FILLED"
      : order.remainingKwh < order.quantityKwh
        ? "PARTIALLY_FILLED"
        : "OPEN";

  state.orders.unshift(order);
  return { order, trades };
}

export function cancelOrder(state: MarketState, orderId: string) {
  const order = state.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new Error("未找到订单。");
  if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") {
    throw new Error("只能取消未完全成交订单。");
  }

  order.status = "CANCELLED";
  if (order.side === "BUY" && order.remainingKwh > 0) {
    const release = vcoinForPower(order.remainingKwh, order.limitPriceCnyKwh);
    state.wallet.vcoinReserved = round(Math.max(0, state.wallet.vcoinReserved - release), 2);
    state.wallet.vcoinAvailable = round(state.wallet.vcoinAvailable + release, 2);
    state.ledger.unshift(
      createLedgerEntry(state.wallet, {
        type: "ORDER_RELEASE",
        amountVcoin: release,
        description: `取消买单释放 ${release.toFixed(2)} V 币`,
        referenceId: order.id
      })
    );
  }

  return order;
}

export function summarizeBook(orders: MarketOrder[], side: "BUY" | "SELL"): OrderBookLevel[] {
  const levels = new Map<number, number>();

  for (const order of orders) {
    if (order.side !== side || order.status === "FILLED" || order.status === "CANCELLED") continue;
    levels.set(
      order.limitPriceCnyKwh,
      round((levels.get(order.limitPriceCnyKwh) ?? 0) + order.remainingKwh, 2)
    );
  }

  return [...levels.entries()]
    .map(([priceCnyKwh, quantityKwh]) => ({ priceCnyKwh, quantityKwh }))
    .sort((a, b) =>
      side === "BUY"
        ? b.priceCnyKwh - a.priceCnyKwh
        : a.priceCnyKwh - b.priceCnyKwh
    )
    .slice(0, 8);
}
