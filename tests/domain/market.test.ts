import { describe, expect, it } from "vitest";
import { applyTopup, cancelOrder, placeOrder } from "@/lib/market";
import type { MarketOrder, Wallet, WalletLedgerEntry } from "@/lib/types";

function createWallet(): Wallet {
  return {
    accountId: "acct_test",
    vcoinAvailable: 1000,
    vcoinReserved: 0,
    tokenBalance: 0,
    kycStatus: "PENDING"
  };
}

function createSellOrder(): MarketOrder {
  return {
    id: "sell_seed",
    accountId: "seller_pool",
    side: "SELL",
    quantityKwh: 10,
    remainingKwh: 10,
    limitPriceCnyKwh: 0.7,
    status: "OPEN",
    createdAt: new Date().toISOString()
  };
}

describe("market ledger and matching", () => {
  it("reserves V coins, matches a buy order, and releases price improvement", () => {
    const wallet = createWallet();
    const state = {
      wallet,
      orders: [createSellOrder()],
      trades: [],
      ledger: [] as WalletLedgerEntry[]
    };

    const result = placeOrder(state, {
      accountId: wallet.accountId,
      side: "BUY",
      quantityKwh: 10,
      limitPriceCnyKwh: 0.8
    });

    expect(result.order.status).toBe("FILLED");
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].notionalVcoin).toBe(70);
    expect(wallet.vcoinAvailable).toBe(930);
    expect(wallet.vcoinReserved).toBe(0);
    expect(state.ledger.map((entry) => entry.type)).toContain("POWER_BUY");
    expect(state.ledger.map((entry) => entry.type)).toContain("ORDER_RELEASE");
  });

  it("releases reserved V coins when an open buy order is cancelled", () => {
    const wallet = createWallet();
    const state = {
      wallet,
      orders: [] as MarketOrder[],
      trades: [],
      ledger: [] as WalletLedgerEntry[]
    };

    const result = placeOrder(state, {
      accountId: wallet.accountId,
      side: "BUY",
      quantityKwh: 10,
      limitPriceCnyKwh: 0.72
    });

    expect(result.order.status).toBe("OPEN");
    expect(wallet.vcoinAvailable).toBe(928);
    expect(wallet.vcoinReserved).toBe(72);

    cancelOrder(state, result.order.id);

    expect(wallet.vcoinAvailable).toBe(1000);
    expect(wallet.vcoinReserved).toBe(0);
  });

  it("credits V coins for a confirmed RMB sandbox topup", () => {
    const wallet = createWallet();
    const ledger: WalletLedgerEntry[] = [];
    const amountVcoin = applyTopup(wallet, ledger, 50, "topup_test");

    expect(amountVcoin).toBe(500);
    expect(wallet.vcoinAvailable).toBe(1500);
    expect(ledger[0]).toMatchObject({
      type: "TOPUP",
      amountVcoin: 500,
      referenceId: "topup_test"
    });
  });
});
