export const VCOIN_PER_CNY = 10;
export const DEFAULT_TOKEN_PRICE_VCOIN = 18.6;
export const POLYGON_CHAIN_ID = 137;

export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
export type KycStatus = "PENDING" | "REVIEW_REQUIRED" | "VERIFIED";
export type DeliveryStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ACCEPTED"
  | "SCHEDULED"
  | "DELIVERING"
  | "SETTLED";
export type TopupStatus = "CREATED" | "CONFIRMED" | "FAILED";
export type TokenPurchaseStatus =
  | "REQUESTED"
  | "AWAITING_TREASURY"
  | "BROADCAST"
  | "CONFIRMED"
  | "SANDBOX_CONFIRMED"
  | "FAILED";

export type PriceTick = {
  id: string;
  timestamp: string;
  priceCnyKwh: number;
  gridLoadMw: number;
  renewableShare: number;
  trend: "up" | "down" | "flat";
};

export type Wallet = {
  accountId: string;
  vcoinAvailable: number;
  vcoinReserved: number;
  tokenBalance: number;
  kycStatus: KycStatus;
};

export type WalletLedgerEntry = {
  id: string;
  accountId: string;
  type:
    | "TOPUP"
    | "POWER_BUY"
    | "POWER_SELL"
    | "ORDER_RESERVE"
    | "ORDER_RELEASE"
    | "TOKEN_PURCHASE"
    | "DELIVERY_SETTLEMENT"
    | "MALL_PURCHASE"
    | "MALL_REFUND";
  amountVcoin: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
};

export type MarketOrder = {
  id: string;
  accountId: string;
  side: OrderSide;
  quantityKwh: number;
  remainingKwh: number;
  limitPriceCnyKwh: number;
  status: OrderStatus;
  createdAt: string;
};

export type Trade = {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  quantityKwh: number;
  priceCnyKwh: number;
  notionalVcoin: number;
  createdAt: string;
};

export type VcoinTopupIntent = {
  id: string;
  accountId: string;
  amountCny: number;
  currency?: string;
  amountVcoin: number;
  provider: "sandbox-rmb" | "stripe";
  status: TopupStatus;
  checkoutUrl: string;
  providerRef?: string;
  createdAt: string;
  confirmedAt?: string;
};

export type TokenPurchase = {
  id: string;
  accountId: string;
  chainId: number;
  network: "polygon";
  tokenAmount: number;
  costVcoin: number;
  walletAddress: string;
  contractAddress: string;
  status: TokenPurchaseStatus;
  transactionHash?: string;
  mode: "READ_ONLY" | "TREASURY_ENABLED" | "SANDBOX";
  createdAt: string;
  updatedAt: string;
};

export type DeliveryInstruction = {
  id: string;
  accountId: string;
  tradeId?: string;
  meterNo: string;
  quantityKwh: number;
  deliveryWindow: string;
  status: DeliveryStatus;
  provider: "sandbox-delivery";
  externalReference?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderBookLevel = {
  priceCnyKwh: number;
  quantityKwh: number;
};

export type DashboardSnapshot = {
  accountId: string;
  currentPrice: PriceTick;
  priceTicks: PriceTick[];
  wallet: Wallet;
  buyBook: OrderBookLevel[];
  sellBook: OrderBookLevel[];
  openOrders: MarketOrder[];
  trades: Trade[];
  ledger: WalletLedgerEntry[];
  topups: VcoinTopupIntent[];
  tokenPurchases: TokenPurchase[];
  deliveries: DeliveryInstruction[];
  tokenConfig: {
    chainId: number;
    chainName: string;
    contractAddress: string;
    hasTreasuryKey: boolean;
  };
};

export type PlaceOrderInput = {
  accountId: string;
  side: OrderSide;
  quantityKwh: number;
  limitPriceCnyKwh: number;
};

export type TopupInput = {
  accountId: string;
  amountCny: number;
};

export type TokenPurchaseInput = {
  accountId: string;
  tokenAmount: number;
  walletAddress: string;
};

export type DeliveryInput = {
  accountId: string;
  meterNo: string;
  quantityKwh: number;
  deliveryWindow: string;
  tradeId?: string;
};
