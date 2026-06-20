import { applyTopup, cancelOrder, createLedgerEntry, placeOrder, summarizeBook } from "@/lib/market";
import { seedPriceTicks } from "@/lib/price";
import { getDeliveryProvider } from "@/lib/providers/delivery";
import { getPaymentProvider } from "@/lib/providers/payment";
import { getTokenConfig, getTokenProvider } from "@/lib/providers/token";
import type {
  DashboardSnapshot,
  DeliveryInput,
  DeliveryInstruction,
  MarketOrder,
  PlaceOrderInput,
  PriceTick,
  TokenPurchase,
  TokenPurchaseInput,
  TopupInput,
  Trade,
  VcoinTopupIntent,
  Wallet,
  WalletLedgerEntry
} from "@/lib/types";

const DEFAULT_ACCOUNT_ID = "acct_volt_demo";

type AppStore = {
  accountId: string;
  wallet: Wallet;
  priceTicks: PriceTick[];
  orders: MarketOrder[];
  trades: Trade[];
  ledger: WalletLedgerEntry[];
  topups: VcoinTopupIntent[];
  tokenPurchases: TokenPurchase[];
  deliveries: DeliveryInstruction[];
};

declare global {
  // eslint-disable-next-line no-var
  var __voltStore: AppStore | undefined;
}

export function getStore() {
  if (!globalThis.__voltStore) {
    globalThis.__voltStore = createInitialStore();
  }
  return globalThis.__voltStore;
}

export function getAccountId() {
  return DEFAULT_ACCOUNT_ID;
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const store = getStore();
  const currentPrice = store.priceTicks.at(-1) ?? seedPriceTicks(1)[0];

  return {
    accountId: store.accountId,
    currentPrice,
    priceTicks: store.priceTicks.slice(-36),
    wallet: { ...store.wallet },
    buyBook: summarizeBook(store.orders, "BUY"),
    sellBook: summarizeBook(store.orders, "SELL"),
    openOrders: store.orders
      .filter((order) => order.accountId === store.accountId)
      .slice(0, 10),
    trades: store.trades.slice(0, 12),
    ledger: store.ledger.slice(0, 12),
    topups: store.topups.slice(0, 8),
    tokenPurchases: store.tokenPurchases.slice(0, 8),
    deliveries: store.deliveries.slice(0, 8),
    tokenConfig: getTokenConfig()
  };
}

export function appendPriceTick(tick: PriceTick) {
  const store = getStore();
  store.priceTicks.push(tick);
  store.priceTicks = store.priceTicks.slice(-80);
  return tick;
}

export function submitOrder(input: PlaceOrderInput) {
  const store = getStore();
  return placeOrder(store, input);
}

export function cancelExistingOrder(orderId: string) {
  const store = getStore();
  return cancelOrder(store, orderId);
}

export async function createTopup(input: TopupInput) {
  const store = getStore();
  const provider = getPaymentProvider();
  const intent = await provider.createTopupIntent(input);
  store.topups.unshift(intent);
  if (intent.status === "CONFIRMED") {
    applyTopup(store.wallet, store.ledger, intent.amountCny, intent.id);
  }
  return intent;
}

export async function createTokenPurchase(input: TokenPurchaseInput) {
  const store = getStore();
  const provider = getTokenProvider();
  const purchase = await provider.createPurchase(input);

  if (store.wallet.vcoinAvailable < purchase.costVcoin) {
    throw new Error("V 币余额不足，无法购买 Token。");
  }

  store.wallet.vcoinAvailable = Number(
    (store.wallet.vcoinAvailable - purchase.costVcoin).toFixed(2)
  );
  if (
    purchase.status === "BROADCAST" ||
    purchase.status === "CONFIRMED" ||
    purchase.status === "SANDBOX_CONFIRMED"
  ) {
    store.wallet.tokenBalance = Number(
      (store.wallet.tokenBalance + purchase.tokenAmount).toFixed(4)
    );
  }

  store.ledger.unshift(
    createLedgerEntry(store.wallet, {
      type: "TOKEN_PURCHASE",
      amountVcoin: -purchase.costVcoin,
      description:
        purchase.mode === "READ_ONLY"
          ? `锁定 ${purchase.costVcoin.toFixed(2)} V 币等待 treasury 转账`
          : `购买 ${purchase.tokenAmount.toFixed(2)} Token`,
      referenceId: purchase.id
    })
  );

  store.tokenPurchases.unshift(purchase);
  return purchase;
}

export async function createDelivery(input: DeliveryInput) {
  const store = getStore();
  const provider = getDeliveryProvider();
  const instruction = await provider.createInstruction(input);
  store.deliveries.unshift(instruction);
  return instruction;
}

function createInitialStore(): AppStore {
  const wallet: Wallet = {
    accountId: DEFAULT_ACCOUNT_ID,
    vcoinAvailable: 12_800,
    vcoinReserved: 0,
    tokenBalance: 0,
    kycStatus: "PENDING"
  };

  const priceTicks = seedPriceTicks(30);
  const accountId = DEFAULT_ACCOUNT_ID;
  const createdAt = new Date().toISOString();
  const orders: MarketOrder[] = [
    {
      id: "seed_sell_1",
      accountId: "grid_pool_south",
      side: "SELL",
      quantityKwh: 168,
      remainingKwh: 168,
      limitPriceCnyKwh: 0.712,
      status: "OPEN",
      createdAt
    },
    {
      id: "seed_sell_2",
      accountId: "storage_pool_east",
      side: "SELL",
      quantityKwh: 96,
      remainingKwh: 96,
      limitPriceCnyKwh: 0.735,
      status: "OPEN",
      createdAt
    },
    {
      id: "seed_buy_1",
      accountId: "park_microgrid",
      side: "BUY",
      quantityKwh: 140,
      remainingKwh: 140,
      limitPriceCnyKwh: 0.682,
      status: "OPEN",
      createdAt
    },
    {
      id: "seed_buy_2",
      accountId: "charging_station_a",
      side: "BUY",
      quantityKwh: 220,
      remainingKwh: 220,
      limitPriceCnyKwh: 0.665,
      status: "OPEN",
      createdAt
    }
  ];
  const ledger: WalletLedgerEntry[] = [
    createLedgerEntry(wallet, {
      type: "TOPUP",
      amountVcoin: 12_800,
      description: "演示账户初始 V 币额度",
      referenceId: "seed_balance"
    })
  ];

  return {
    accountId,
    wallet,
    priceTicks,
    orders,
    trades: [],
    ledger,
    topups: [],
    tokenPurchases: [],
    deliveries: []
  };
}
