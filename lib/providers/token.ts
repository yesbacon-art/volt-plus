import { isAddress } from "viem";
import { createId } from "@/lib/id";
import { round } from "@/lib/price";
import {
  DEFAULT_TOKEN_PRICE_VCOIN,
  POLYGON_CHAIN_ID,
  type TokenPurchase,
  type TokenPurchaseInput
} from "@/lib/types";

export interface TokenProvider {
  createPurchase(input: TokenPurchaseInput): Promise<TokenPurchase>;
}

export function getTokenConfig() {
  const contractAddress =
    process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS ??
    process.env.TOKEN_CONTRACT_ADDRESS ??
    "0x0000000000000000000000000000000000000000";

  return {
    chainId: Number(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID ?? POLYGON_CHAIN_ID),
    chainName: "Polygon PoS",
    contractAddress,
    hasTreasuryKey: Boolean(process.env.TOKEN_TREASURY_PRIVATE_KEY)
  };
}

export class PolygonErc20TokenProvider implements TokenProvider {
  async createPurchase(input: TokenPurchaseInput): Promise<TokenPurchase> {
    if (!isAddress(input.walletAddress)) {
      throw new Error("请输入有效的 EVM 钱包地址。");
    }
    if (input.tokenAmount <= 0) {
      throw new Error("Token 数量必须大于 0。");
    }

    const config = getTokenConfig();
    const now = new Date().toISOString();
    const costVcoin = round(input.tokenAmount * DEFAULT_TOKEN_PRICE_VCOIN, 2);
    const sandboxMode = process.env.TOKEN_SANDBOX_MODE === "true";

    return {
      id: createId("token"),
      accountId: input.accountId,
      chainId: config.chainId,
      network: "polygon",
      tokenAmount: input.tokenAmount,
      costVcoin,
      walletAddress: input.walletAddress,
      contractAddress: config.contractAddress,
      status: sandboxMode ? "SANDBOX_CONFIRMED" : "AWAITING_TREASURY",
      transactionHash: sandboxMode ? createSandboxTxHash() : undefined,
      mode: sandboxMode ? "SANDBOX" : config.hasTreasuryKey ? "TREASURY_ENABLED" : "READ_ONLY",
      createdAt: now,
      updatedAt: now
    };
  }
}

export function getTokenProvider(): TokenProvider {
  return new PolygonErc20TokenProvider();
}

function createSandboxTxHash() {
  const suffix = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `0x${suffix}`;
}
