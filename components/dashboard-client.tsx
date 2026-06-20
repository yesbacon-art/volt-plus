"use client";

import {
  ArrowDownUp,
  BadgeCheck,
  BatteryCharging,
  CircleDollarSign,
  Factory,
  FileCheck2,
  Landmark,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  WalletCards,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { DEFAULT_TOKEN_PRICE_VCOIN, VCOIN_PER_CNY } from "@/lib/types";
import type {
  DashboardSnapshot,
  MarketOrder,
  OrderBookLevel,
  OrderSide,
  PriceTick,
  WalletLedgerEntry
} from "@/lib/types";

type DashboardClientProps = {
  initialSnapshot: DashboardSnapshot;
};

type ApiResponse = {
  snapshot: DashboardSnapshot;
  error?: string;
};

const DEFAULT_WALLET_ADDRESS = "0x742d35cc6634c0532925a3b844bc454e4438f44e";

export function DashboardClient({ initialSnapshot }: DashboardClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [side, setSide] = useState<OrderSide>("BUY");
  const [quantityKwh, setQuantityKwh] = useState("60");
  const [limitPrice, setLimitPrice] = useState(
    initialSnapshot.currentPrice.priceCnyKwh.toFixed(3)
  );
  const [topupAmount, setTopupAmount] = useState("1000");
  const [tokenAmount, setTokenAmount] = useState("120");
  const [walletAddress, setWalletAddress] = useState(DEFAULT_WALLET_ADDRESS);
  const [meterNo, setMeterNo] = useState("HD-330106-8842");
  const [deliveryQuantity, setDeliveryQuantity] = useState("80");
  const [deliveryWindow, setDeliveryWindow] = useState("2026-06-12 09:00-11:00");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("实时电价流已连接");

  useEffect(() => {
    const source = new EventSource("/api/prices/stream");
    source.onmessage = (event) => {
      const tick = JSON.parse(event.data) as PriceTick;
      setSnapshot((current) => ({
        ...current,
        currentPrice: tick,
        priceTicks: [...current.priceTicks.slice(-35), tick]
      }));
    };
    source.onerror = () => {
      setNotice("实时电价流重连中");
    };
    source.onopen = () => {
      setNotice("实时电价流已连接");
    };
    return () => source.close();
  }, []);

  const estimatedVcoin = useMemo(() => {
    const quantity = Number(quantityKwh) || 0;
    const price = Number(limitPrice) || 0;
    return quantity * price * VCOIN_PER_CNY;
  }, [limitPrice, quantityKwh]);

  const tokenCost = useMemo(() => {
    return (Number(tokenAmount) || 0) * DEFAULT_TOKEN_PRICE_VCOIN;
  }, [tokenAmount]);

  async function postJson(path: string, body: Record<string, unknown>, action: string) {
    setPendingAction(action);
    setNotice("提交中");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "请求失败");
      }
      setSnapshot(data.snapshot);
      setNotice("已更新");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "请求失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteJson(path: string, body: Record<string, unknown>, action: string) {
    setPendingAction(action);
    try {
      const response = await fetch(path, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "请求失败");
      }
      setSnapshot(data.snapshot);
      setNotice("订单已取消");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "请求失败");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 text-graphite sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <TopBar snapshot={snapshot} notice={notice} />

        <section className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr_.95fr]">
          <div className="flex flex-col gap-5">
            <PricePanel snapshot={snapshot} />
            <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
              <PanelTitle
                icon={<ArrowDownUp className="h-5 w-5" />}
                title="电力交易"
                aside={`${snapshot.currentPrice.priceCnyKwh.toFixed(3)} 元/kWh`}
              />
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-[#edf3f0] p-1">
                <button
                  className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${
                    side === "BUY" ? "bg-white text-volt shadow-sm" : "text-[#5f6b70]"
                  }`}
                  onClick={() => setSide("BUY")}
                  type="button"
                >
                  买电
                </button>
                <button
                  className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${
                    side === "SELL" ? "bg-white text-moss shadow-sm" : "text-[#5f6b70]"
                  }`}
                  onClick={() => setSide("SELL")}
                  type="button"
                >
                  卖电
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field
                  label="电量 kWh"
                  value={quantityKwh}
                  onChange={setQuantityKwh}
                  inputMode="decimal"
                />
                <Field
                  label="限价 元/kWh"
                  value={limitPrice}
                  onChange={setLimitPrice}
                  inputMode="decimal"
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border border-[#dfe8df] bg-[#f8fbf8] px-3 py-3">
                <span className="text-sm text-[#5f6b70]">预计结算</span>
                <strong className="text-lg">{formatNumber(estimatedVcoin)} V 币</strong>
              </div>

              <button
                className={`focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 font-semibold text-white transition ${
                  side === "BUY"
                    ? "bg-volt hover:bg-[#008ca6]"
                    : "bg-moss hover:bg-[#42793b]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={pendingAction === "order"}
                onClick={() =>
                  postJson(
                    "/api/orders",
                    {
                      side,
                      quantityKwh: Number(quantityKwh),
                      limitPriceCnyKwh: Number(limitPrice)
                    },
                    "order"
                  )
                }
                type="button"
              >
                {side === "BUY" ? (
                  <ShoppingCart className="h-5 w-5" />
                ) : (
                  <BatteryCharging className="h-5 w-5" />
                )}
                {side === "BUY" ? "提交买电单" : "提交卖电单"}
              </button>
            </section>
          </div>

          <div className="flex flex-col gap-5">
            <MarketDepth
              buyBook={snapshot.buyBook}
              sellBook={snapshot.sellBook}
              trades={snapshot.trades}
            />
            <OpenOrders
              orders={snapshot.openOrders}
              pendingAction={pendingAction}
              onCancel={(orderId) => deleteJson("/api/orders", { orderId }, "cancel-order")}
            />
          </div>

          <div className="flex flex-col gap-5">
            <WalletPanel
              snapshot={snapshot}
              topupAmount={topupAmount}
              setTopupAmount={setTopupAmount}
              onTopup={() =>
                postJson(
                  "/api/wallet/topups",
                  { amountCny: Number(topupAmount) },
                  "topup"
                )
              }
              pendingAction={pendingAction}
            />
            <TokenPanel
              snapshot={snapshot}
              tokenAmount={tokenAmount}
              setTokenAmount={setTokenAmount}
              walletAddress={walletAddress}
              setWalletAddress={setWalletAddress}
              tokenCost={tokenCost}
              pendingAction={pendingAction}
              onPurchase={() =>
                postJson(
                  "/api/token/purchases",
                  {
                    tokenAmount: Number(tokenAmount),
                    walletAddress
                  },
                  "token"
                )
              }
            />
            <DeliveryPanel
              snapshot={snapshot}
              meterNo={meterNo}
              setMeterNo={setMeterNo}
              deliveryQuantity={deliveryQuantity}
              setDeliveryQuantity={setDeliveryQuantity}
              deliveryWindow={deliveryWindow}
              setDeliveryWindow={setDeliveryWindow}
              pendingAction={pendingAction}
              onCreate={() =>
                postJson(
                  "/api/delivery/instructions",
                  {
                    meterNo,
                    quantityKwh: Number(deliveryQuantity),
                    deliveryWindow,
                    tradeId: snapshot.trades[0]?.id
                  },
                  "delivery"
                )
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function TopBar({ snapshot, notice }: { snapshot: DashboardSnapshot; notice: string }) {
  return (
    <header className="flex flex-col gap-4 overflow-hidden rounded-lg bg-gradient-to-r from-[#209f98] via-[#188c86] to-[#102328] px-5 py-4 text-white shadow-soft-panel lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <img
          src="/brand/volt-logo.svg"
          alt="VOLT+ logo"
          className="h-[72px] w-[clamp(168px,18vw,270px)] object-contain object-left"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-normal text-white sm:text-3xl">
              伏特家
            </h1>
            <span className="rounded border border-white/25 bg-white/15 px-2 py-1 text-sm font-bold text-white">
              智能电力交易台
            </span>
          </div>
          <p className="mt-1 text-sm text-white/75">
            实时电价 · V 币结算 · Polygon Token · 沙盒交割
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
        <StatusPill
          icon={<ShieldCheck className="h-4 w-4" />}
          label="KYC"
          value={snapshot.wallet.kycStatus}
        />
        <StatusPill
          icon={<PlugZap className="h-4 w-4" />}
          label="电价流"
          value={notice}
        />
        <StatusPill
          icon={<Landmark className="h-4 w-4" />}
          label="支付"
          value="人民币沙盒"
        />
      </div>
    </header>
  );
}

function PricePanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const current = snapshot.currentPrice;
  const trendColor =
    current.trend === "up"
      ? "text-signal"
      : current.trend === "down"
        ? "text-moss"
        : "text-[#5f6b70]";

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle
        icon={<Zap className="h-5 w-5" />}
        title="实时电价"
        aside={formatTime(current.timestamp)}
      />
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[2.75rem] font-black leading-none text-graphite">
            {current.priceCnyKwh.toFixed(3)}
          </div>
          <div className="mt-1 text-sm text-[#5f6b70]">元/kWh</div>
        </div>
        <div className={`text-right text-sm font-bold ${trendColor}`}>
          {current.trend === "up" ? "上行" : current.trend === "down" ? "下行" : "平稳"}
        </div>
      </div>
      <Sparkline ticks={snapshot.priceTicks} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="电网负荷" value={`${formatNumber(current.gridLoadMw)} MW`} />
        <Metric label="绿电占比" value={`${current.renewableShare}%`} />
      </div>
    </section>
  );
}

function MarketDepth({
  buyBook,
  sellBook,
  trades
}: {
  buyBook: OrderBookLevel[];
  sellBook: OrderBookLevel[];
  trades: DashboardSnapshot["trades"];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle icon={<Factory className="h-5 w-5" />} title="订单簿与成交" aside="kWh" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BookSide title="买盘" levels={buyBook} tone="buy" />
        <BookSide title="卖盘" levels={sellBook} tone="sell" />
      </div>
      <div className="mt-5">
        <h3 className="text-sm font-bold text-[#3b464b]">最新成交</h3>
        <div className="mt-2 grid gap-2">
          {trades.length === 0 ? (
            <EmptyState text="暂无成交" />
          ) : (
            trades.slice(0, 5).map((trade) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-[#edf0ee] px-3 py-2 text-sm"
                key={trade.id}
              >
                <span className="truncate">{formatTime(trade.createdAt)}</span>
                <strong>{trade.quantityKwh.toFixed(2)} kWh</strong>
                <span>{trade.priceCnyKwh.toFixed(3)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function OpenOrders({
  orders,
  pendingAction,
  onCancel
}: {
  orders: MarketOrder[];
  pendingAction: string | null;
  onCancel: (orderId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle icon={<FileCheck2 className="h-5 w-5" />} title="我的订单" aside="VOLT+" />
      <div className="mt-4 grid gap-2">
        {orders.length === 0 ? (
          <EmptyState text="暂无订单" />
        ) : (
          orders.map((order) => (
            <div
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-[#edf0ee] px-3 py-3"
              key={order.id}
            >
              <span
                className={`rounded px-2 py-1 text-xs font-bold ${
                  order.side === "BUY"
                    ? "bg-volt/10 text-[#007f95]"
                    : "bg-moss/10 text-moss"
                }`}
              >
                {order.side === "BUY" ? "买" : "卖"}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {order.remainingKwh.toFixed(2)} / {order.quantityKwh.toFixed(2)} kWh
                </div>
                <div className="text-xs text-[#69757a]">
                  {order.limitPriceCnyKwh.toFixed(3)} 元/kWh · {order.status}
                </div>
              </div>
              <button
                aria-label="取消订单"
                className="focus-ring rounded-md border border-[#dfe8df] p-2 text-[#657176] transition hover:border-signal hover:text-signal disabled:opacity-40"
                disabled={
                  pendingAction === "cancel-order" ||
                  (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED")
                }
                onClick={() => onCancel(order.id)}
                title="取消订单"
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function WalletPanel({
  snapshot,
  topupAmount,
  setTopupAmount,
  onTopup,
  pendingAction
}: {
  snapshot: DashboardSnapshot;
  topupAmount: string;
  setTopupAmount: (value: string) => void;
  onTopup: () => void;
  pendingAction: string | null;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle
        icon={<WalletCards className="h-5 w-5" />}
        title="V 币钱包"
        aside="1 元 = 10 V"
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="可用 V 币" value={formatNumber(snapshot.wallet.vcoinAvailable)} />
        <Metric label="冻结 V 币" value={formatNumber(snapshot.wallet.vcoinReserved)} />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Field label="人民币充值" value={topupAmount} onChange={setTopupAmount} inputMode="decimal" />
        <button
          className="focus-ring self-end rounded-md bg-ember px-4 py-3 font-bold text-graphite transition hover:bg-[#f5a900] disabled:opacity-50"
          disabled={pendingAction === "topup"}
          onClick={onTopup}
          type="button"
        >
          充值
        </button>
      </div>
      <LedgerList entries={snapshot.ledger} />
    </section>
  );
}

function TokenPanel({
  snapshot,
  tokenAmount,
  setTokenAmount,
  walletAddress,
  setWalletAddress,
  tokenCost,
  pendingAction,
  onPurchase
}: {
  snapshot: DashboardSnapshot;
  tokenAmount: string;
  setTokenAmount: (value: string) => void;
  walletAddress: string;
  setWalletAddress: (value: string) => void;
  tokenCost: number;
  pendingAction: string | null;
  onPurchase: () => void;
}) {
  const latest = snapshot.tokenPurchases[0];

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle
        icon={<CircleDollarSign className="h-5 w-5" />}
        title="Token 购买"
        aside={snapshot.tokenConfig.chainName}
      />
      <div className="mt-4 grid gap-3">
        <Field label="Token 数量" value={tokenAmount} onChange={setTokenAmount} inputMode="decimal" />
        <Field label="EVM 钱包" value={walletAddress} onChange={setWalletAddress} compact />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-[#dfe8df] bg-[#f8fbf8] px-3 py-3 text-sm">
        <span className="text-[#5f6b70]">预计扣款</span>
        <strong>{formatNumber(tokenCost)} V 币</strong>
      </div>
      <button
        className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-graphite px-4 py-3 font-semibold text-white transition hover:bg-[#0f171c] disabled:opacity-50"
        disabled={pendingAction === "token"}
        onClick={onPurchase}
        type="button"
      >
        <BadgeCheck className="h-5 w-5" />
        购买 Token
      </button>
      <div className="mt-3 rounded-md border border-[#edf0ee] px-3 py-3 text-sm text-[#566166]">
        <div className="truncate">合约：{snapshot.tokenConfig.contractAddress}</div>
        <div className="mt-1">
          模式：{snapshot.tokenConfig.hasTreasuryKey ? "treasury 已配置" : "只读/待转账"}
        </div>
        {latest ? <div className="mt-1">最近状态：{latest.status}</div> : null}
      </div>
    </section>
  );
}

function DeliveryPanel({
  snapshot,
  meterNo,
  setMeterNo,
  deliveryQuantity,
  setDeliveryQuantity,
  deliveryWindow,
  setDeliveryWindow,
  pendingAction,
  onCreate
}: {
  snapshot: DashboardSnapshot;
  meterNo: string;
  setMeterNo: (value: string) => void;
  deliveryQuantity: string;
  setDeliveryQuantity: (value: string) => void;
  deliveryWindow: string;
  setDeliveryWindow: (value: string) => void;
  pendingAction: string | null;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white/90 p-4 shadow-soft-panel">
      <PanelTitle icon={<RefreshCcw className="h-5 w-5" />} title="电力交割" aside="sandbox" />
      <div className="mt-4 grid gap-3">
        <Field label="计量点编号" value={meterNo} onChange={setMeterNo} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="交割 kWh"
            value={deliveryQuantity}
            onChange={setDeliveryQuantity}
            inputMode="decimal"
          />
          <Field label="交割窗口" value={deliveryWindow} onChange={setDeliveryWindow} compact />
        </div>
      </div>
      <button
        className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-volt bg-volt px-4 py-3 font-semibold text-white transition hover:bg-[#008ca6] disabled:opacity-50"
        disabled={pendingAction === "delivery"}
        onClick={onCreate}
        type="button"
      >
        <PlugZap className="h-5 w-5" />
        创建交割指令
      </button>
      <div className="mt-3 grid gap-2">
        {snapshot.deliveries.length === 0 ? (
          <EmptyState text="暂无交割指令" />
        ) : (
          snapshot.deliveries.slice(0, 3).map((delivery) => (
            <div
              className="rounded-md border border-[#edf0ee] px-3 py-2 text-sm"
              key={delivery.id}
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{delivery.quantityKwh.toFixed(2)} kWh</strong>
                <span className="text-moss">{delivery.status}</span>
              </div>
              <div className="mt-1 truncate text-[#69757a]">{delivery.externalReference}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PanelTitle({
  icon,
  title,
  aside
}: {
  icon: ReactNode;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#edf3f0] text-volt">
          {icon}
        </span>
        <h2 className="truncate text-lg font-black tracking-normal">{title}</h2>
      </div>
      {aside ? <span className="shrink-0 text-sm font-semibold text-[#667277]">{aside}</span> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  compact = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-[#657176]">
        {label}
      </span>
      <input
        className={`focus-ring w-full rounded-md border border-[#dfe8df] bg-white px-3 py-3 font-semibold text-graphite outline-none transition ${
          compact ? "text-xs" : "text-sm"
        }`}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#edf0ee] bg-[#fbfcfb] px-3 py-3">
      <div className="text-xs font-bold uppercase tracking-normal text-[#6f7a7f]">{label}</div>
      <div className="mt-1 text-lg font-black text-graphite">{value}</div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#dfe8df] bg-[#fbfcfb] px-3 py-2">
      <span className="text-volt">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-normal text-[#748086]">{label}</div>
        <div className="truncate text-sm font-bold text-graphite">{value}</div>
      </div>
    </div>
  );
}

function Sparkline({ ticks }: { ticks: PriceTick[] }) {
  const points = useMemo(() => {
    if (ticks.length === 0) return "";
    const prices = ticks.map((tick) => tick.priceCnyKwh);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(0.001, max - min);
    return ticks
      .map((tick, index) => {
        const x = (index / Math.max(1, ticks.length - 1)) * 100;
        const y = 82 - ((tick.priceCnyKwh - min) / spread) * 64;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [ticks]);

  return (
    <svg
      aria-label="实时电价曲线"
      className="mt-5 h-28 w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient id="priceLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#00a7c4" />
          <stop offset="58%" stopColor="#4f8f46" />
          <stop offset="100%" stopColor="#ffb703" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        points={points}
        stroke="url(#priceLine)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BookSide({
  title,
  levels,
  tone
}: {
  title: string;
  levels: OrderBookLevel[];
  tone: "buy" | "sell";
}) {
  const maxQuantity = Math.max(1, ...levels.map((level) => level.quantityKwh));

  return (
    <div>
      <h3 className="text-sm font-bold text-[#3b464b]">{title}</h3>
      <div className="mt-2 grid gap-2">
        {levels.length === 0 ? (
          <EmptyState text="暂无挂单" />
        ) : (
          levels.map((level) => (
            <div
              className="relative overflow-hidden rounded-md border border-[#edf0ee] px-3 py-2 text-sm"
              key={`${tone}-${level.priceCnyKwh}`}
            >
              <div
                className={`absolute inset-y-0 left-0 ${
                  tone === "buy" ? "bg-volt/10" : "bg-moss/10"
                }`}
                style={{ width: `${Math.max(12, (level.quantityKwh / maxQuantity) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <strong>{level.priceCnyKwh.toFixed(3)}</strong>
                <span>{level.quantityKwh.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LedgerList({ entries }: { entries: WalletLedgerEntry[] }) {
  return (
    <div className="mt-4 grid gap-2">
      {entries.slice(0, 4).map((entry) => (
        <div
          className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-[#edf0ee] px-3 py-2 text-sm"
          key={entry.id}
        >
          <div className="min-w-0">
            <div className="truncate font-semibold">{entry.description}</div>
            <div className="text-xs text-[#69757a]">{formatTime(entry.createdAt)}</div>
          </div>
          <span className={entry.amountVcoin >= 0 ? "font-bold text-moss" : "font-bold text-signal"}>
            {entry.amountVcoin >= 0 ? "+" : ""}
            {formatNumber(entry.amountVcoin)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#d7dfdc] px-3 py-5 text-center text-sm text-[#69757a]">
      {text}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
