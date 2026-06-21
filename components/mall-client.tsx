"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  priceVcoin: number;
  stock: number;
  specs: string[];
};

type SessionState = {
  account: {
    id: string;
    email: string | null;
    phone: string | null;
    displayName: string;
    kycStatus: string;
  } | null;
  wallet: {
    vcoinAvailable: number;
    vcoinReserved: number;
    tokenBalance: number;
  } | null;
};

type MallOrder = {
  id: string;
  status: string;
  totalVcoin: string | number;
  receiverName: string;
  address: string;
  meterNo: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    totalVcoin: string | number;
  }>;
};

type MallClientProps = {
  databaseReady: boolean;
  initialProducts: Product[];
  initialSession: SessionState;
};

const SANDBOX_STORAGE_KEY = "volt_plus_mall_sandbox_v1";

export function MallClient({ databaseReady, initialProducts, initialSession }: MallClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [session, setSession] = useState(initialSession);
  const [orders, setOrders] = useState<MallOrder[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("demo@volt.plus");
  const [password, setPassword] = useState("Voltplus123");
  const [displayName, setDisplayName] = useState("VOLT+ Overseas Buyer");
  const [amountFiat, setAmountFiat] = useState(50);
  const [currency, setCurrency] = useState("USD");
  const [receiverName, setReceiverName] = useState("VOLT+ Buyer");
  const [address, setAddress] = useState("120 Energy Market Street, Singapore");
  const [meterNo, setMeterNo] = useState("METER-SG-8842");
  const [notice, setNotice] = useState(
    databaseReady
      ? "V 币商城真实后端已就绪"
      : "V 币商城沙盒已就绪：可注册、充值、购买和查看订单"
  );
  const [pending, setPending] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0],
    [products, selectedProductId]
  );

  const totalVcoin = selectedProduct ? selectedProduct.priceVcoin * quantity : 0;
  const balance = Number(session.wallet?.vcoinAvailable ?? 0);
  const accountId = session.account?.id;

  useEffect(() => {
    if (databaseReady) return;

    const saved = readSandboxState();
    if (saved) {
      setSession(saved.session);
      setOrders(saved.orders);
    }
  }, [databaseReady]);

  useEffect(() => {
    if (databaseReady && accountId) {
      void refreshOrders();
    }
  }, [databaseReady, accountId]);

  async function refreshSession() {
    const response = await fetch("/api/auth/session");
    const data = (await response.json()) as SessionState;
    setSession({
      account: data.account,
      wallet: data.wallet
        ? {
            vcoinAvailable: Number(data.wallet.vcoinAvailable),
            vcoinReserved: Number(data.wallet.vcoinReserved),
            tokenBalance: Number(data.wallet.tokenBalance)
          }
        : null
    });
  }

  async function refreshProducts() {
    const response = await fetch("/api/mall/products");
    const data = (await response.json()) as { products: Product[] };
    setProducts(
      data.products.map((product) => ({
        ...product,
        priceVcoin: Number(product.priceVcoin)
      }))
    );
  }

  async function refreshOrders() {
    const response = await fetch("/api/mall/orders");
    if (!response.ok) return;
    const data = (await response.json()) as { orders: MallOrder[] };
    setOrders(data.orders);
  }

  async function submitAuth() {
    if (!databaseReady) {
      setPending("auth");
      const nextSession: SessionState = {
        account: {
          id: `sandbox_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          email,
          phone: null,
          displayName: authMode === "register" ? displayName : displayName || "VOLT+ Buyer",
          kycStatus: "SANDBOX"
        },
        wallet: session.wallet ?? {
          vcoinAvailable: 12800,
          vcoinReserved: 0,
          tokenBalance: 0
        }
      };
      setSession(nextSession);
      writeSandboxState(nextSession, orders);
      setNotice(authMode === "register" ? "沙盒账户创建成功，已登录" : "沙盒登录成功");
      setPending(null);
      return;
    }

    setPending("auth");
    setNotice("正在处理账户");
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "账户请求失败。");
      }
      await refreshSession();
      await refreshOrders();
      setNotice(authMode === "register" ? "注册成功，已登录" : "登录成功");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "账户请求失败。");
    } finally {
      setPending(null);
    }
  }

  async function logout() {
    if (!databaseReady) {
      window.localStorage.removeItem(SANDBOX_STORAGE_KEY);
      setSession({ account: null, wallet: null });
      setOrders([]);
      setNotice("已退出沙盒账户");
      return;
    }

    setPending("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ account: null, wallet: null });
    setOrders([]);
    setNotice("已退出登录");
    setPending(null);
  }

  async function createTopup() {
    if (!databaseReady) {
      if (!session.account) {
        setNotice("请先注册或登录沙盒账户。");
        return;
      }

      const amountVcoin = fiatToSandboxVcoin(amountFiat, currency);
      const nextSession: SessionState = {
        ...session,
        wallet: {
          vcoinAvailable: Number((balance + amountVcoin).toFixed(4)),
          vcoinReserved: Number(session.wallet?.vcoinReserved ?? 0),
          tokenBalance: Number(session.wallet?.tokenBalance ?? 0)
        }
      };
      setSession(nextSession);
      writeSandboxState(nextSession, orders);
      setNotice(`沙盒充值成功，已入账 ${format(amountVcoin)} V 币`);
      return;
    }

    setPending("topup");
    setNotice("正在创建 Stripe Checkout");
    try {
      const response = await fetch("/api/wallet/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountFiat, currency })
      });
      const data = (await response.json()) as {
        error?: string;
        topup?: { checkoutUrl?: string };
      };
      if (!response.ok) {
        throw new Error(data.error ?? "充值请求失败。");
      }
      if (data.topup?.checkoutUrl?.startsWith("http")) {
        window.location.href = data.topup.checkoutUrl;
        return;
      }
      await refreshSession();
      setNotice("沙盒充值已入账；生产环境会跳转到 Stripe Checkout。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "充值请求失败。");
    } finally {
      setPending(null);
    }
  }

  async function purchaseProduct() {
    if (!selectedProduct) return;
    if (!databaseReady) {
      if (!session.account || !session.wallet) {
        setNotice("请先注册或登录沙盒账户。");
        return;
      }
      if (quantity > selectedProduct.stock) {
        setNotice(`${selectedProduct.name} 库存不足。`);
        return;
      }
      if (balance < totalVcoin) {
        setNotice("V 币余额不足，请先进行沙盒充值。");
        return;
      }

      const order: MallOrder = {
        id: `sandbox_order_${Date.now()}`,
        status: "PAID",
        totalVcoin,
        receiverName,
        address,
        meterNo,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: `sandbox_item_${selectedProduct.id}`,
            productName: selectedProduct.name,
            quantity,
            totalVcoin
          }
        ]
      };
      const nextSession: SessionState = {
        ...session,
        wallet: {
          ...session.wallet,
          vcoinAvailable: Number((balance - totalVcoin).toFixed(4))
        }
      };
      const nextOrders = [order, ...orders];
      setSession(nextSession);
      setOrders(nextOrders);
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? { ...product, stock: Math.max(0, product.stock - quantity) }
            : product
        )
      );
      writeSandboxState(nextSession, nextOrders);
      setNotice(`沙盒购买成功，已扣除 ${format(totalVcoin)} V 币`);
      return;
    }

    setPending("purchase");
    setNotice("正在提交商城订单");
    try {
      const response = await fetch("/api/mall/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: selectedProduct.id, quantity }],
          receiverName,
          address,
          meterNo
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "下单失败。");
      }
      await Promise.all([refreshSession(), refreshProducts(), refreshOrders()]);
      setNotice(`购买成功，已扣除 ${format(totalVcoin)} V`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "下单失败。");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#07131e] text-[#f6fffd]">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#050d19]/90 backdrop-blur">
        <div className="mx-auto grid min-h-[74px] max-w-[1560px] grid-cols-[auto_1fr_auto] items-center gap-6 px-5 max-lg:grid-cols-1 max-lg:justify-items-center max-lg:py-3">
          <Link href="/" aria-label="返回首页">
            <img
              src="/brand/volt-logo.svg"
              alt="VOLT+ logo"
              className="h-14 w-[168px] object-contain object-left"
            />
          </Link>
          <div className="flex flex-wrap justify-center gap-2 text-sm font-extrabold text-white/80">
            <Link className="rounded-lg px-4 py-3 hover:bg-[#18d5c6]/10 hover:text-[#18d5c6]" href="/">
              首页
            </Link>
            <Link className="rounded-lg px-4 py-3 hover:bg-[#18d5c6]/10 hover:text-[#18d5c6]" href="/#trade">
              电力交易
            </Link>
            <Link className="rounded-lg px-4 py-3 hover:bg-[#18d5c6]/10 hover:text-[#18d5c6]" href="/#vcoin">
              V币中心
            </Link>
            <Link className="rounded-lg bg-[#18d5c6]/10 px-4 py-3 text-[#18d5c6]" href="/mall">
              V币商城
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {session.account ? (
              <>
                <span className="rounded-full border border-[#18d5c6]/30 bg-[#18d5c6]/10 px-4 py-2 text-sm font-black text-[#d9fffb]">
                  {session.account.displayName}
                </span>
                <button className="rounded-lg border border-white/15 px-4 py-2 font-black" onClick={logout} type="button">
                  退出
                </button>
              </>
            ) : (
              <span className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white/70">
                未登录
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1560px] gap-5 px-5 py-8">
        <section className="grid min-h-[360px] grid-cols-[0.9fr_1.1fr] items-stretch gap-6 max-lg:grid-cols-1">
          <div className="grid content-center">
            <span className="w-max rounded-full border border-[#18d5c6]/30 bg-[#18d5c6]/10 px-3 py-2 text-xs font-black text-[#18d5c6]">
              {databaseReady ? "VOLT+ REAL COMMERCE" : "VOLT+ SANDBOX COMMERCE"}
            </span>
            <h1 className="mt-5 text-5xl font-black leading-tight max-sm:text-4xl">
              V 币商城
              <span className="block text-[#18d5c6]">
                {databaseReady ? "真实账户 · 钱包账本 · 后端订单" : "沙盒账户 · V 币充值 · 商品购买"}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#c4d7db]">
              {databaseReady
                ? "这一版不再把余额和订单存在浏览器本地。登录后通过 Stripe 充值 V 币，商城购买会进入 PostgreSQL 钱包账本、库存和订单表。"
                : "当前公网版本先运行完整沙盒交易：注册/登录、V 币充值、商品购买和订单记录都可以直接操作；连接 PostgreSQL 后会自动切换到真实后端。"}
            </p>
            <div className="mt-6 rounded-xl border border-[#18d5c6]/20 bg-[#0a1c2b]/80 p-4 text-sm font-extrabold text-[#d8fffb]">
              {notice}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#18d5c6]/20 bg-[#0a1c2b]/80 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(24,213,198,0.28),transparent_32%)]" />
            <div className="relative grid h-full place-items-center">
              <div className="grid h-36 w-36 place-items-center rounded-full border border-[#18d5c6]/60 bg-[#18d5c6]/20 text-6xl font-black text-white shadow-[0_0_46px_rgba(24,213,198,0.45)]">
                V
              </div>
              <div className="mt-8 grid w-full grid-cols-2 gap-3 text-sm font-black text-[#dffdfa]">
                {["家庭储能", "智能充电", "光伏运维", "AI 服务"].map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Metric label="可用 V 币" value={`${format(balance)} V`} note={databaseReady ? "服务端钱包" : "沙盒钱包"} />
          <Metric label="商品 SKU" value={`${products.length}`} note={databaseReady ? "Postgres 商品表" : "沙盒商品目录"} />
          <Metric label="我的订单" value={`${orders.length}`} note={databaseReady ? "商城订单表" : "本地沙盒订单"} />
          <Metric label="支付通道" value={databaseReady ? "Stripe" : "Sandbox"} note={databaseReady ? "Checkout + Webhook" : "即时充值入账"} />
        </section>

        <section className="grid grid-cols-[1fr_390px] gap-5 max-xl:grid-cols-1">
          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-black">产品购买</h2>
                <p className="mt-2 text-[#9eb7bc]">
                  {databaseReady ? "商品、价格和库存来自数据库。" : "商品、价格和库存来自沙盒目录，购买后会生成订单。"}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-[#d8fffb]">
                V币结算
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
              {products.map((product) => (
                <article
                  className={`grid rounded-xl border bg-[#0a1c2b]/80 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] ${
                    selectedProduct?.id === product.id
                      ? "border-[#18d5c6]/70"
                      : "border-[#47e2db]/20"
                  }`}
                  key={product.id}
                >
                  <button className="text-left" onClick={() => setSelectedProductId(product.id)} type="button">
                    <div className="grid min-h-32 place-items-center rounded-lg border border-white/10 bg-white/5 text-4xl font-black text-white">
                      {product.name.slice(0, 2)}
                    </div>
                    <h3 className="mt-4 text-xl font-black">{product.name}</h3>
                    <p className="mt-2 min-h-16 text-sm leading-6 text-[#9eb7bc]">{product.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.specs.map((spec) => (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-extrabold" key={spec}>
                          {spec}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <strong className="text-xl text-[#18d5c6]">{format(product.priceVcoin)} V</strong>
                      <span className="text-xs font-bold text-[#9eb7bc]">{product.category} · 库存 {product.stock}</span>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <Panel title={session.account ? "账户钱包" : "注册 / 登录"}>
              {session.account ? (
                <div className="grid gap-3">
                  <div>
                    <span className="text-sm font-bold text-[#9eb7bc]">当前账户</span>
                    <strong className="block text-xl">{session.account.displayName}</strong>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#9eb7bc]">可用余额</span>
                    <strong className="block text-4xl text-[#18d5c6]">{format(balance)} V</strong>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-1">
                    <button className={tabClass(authMode === "register")} onClick={() => setAuthMode("register")} type="button">
                      注册
                    </button>
                    <button className={tabClass(authMode === "login")} onClick={() => setAuthMode("login")} type="button">
                      登录
                    </button>
                  </div>
                  {authMode === "register" && (
                    <Field label="昵称 / 企业名" value={displayName} onChange={setDisplayName} />
                  )}
                  <Field label="邮箱" value={email} onChange={setEmail} />
                  <Field label="密码" value={password} onChange={setPassword} type="password" />
                  <button className="rounded-lg bg-[#18d5c6] px-4 py-3 font-black text-[#03171a] disabled:opacity-50" disabled={pending === "auth"} onClick={submitAuth} type="button">
                    {databaseReady
                      ? authMode === "register"
                        ? "创建真实账户"
                        : "登录账户"
                      : authMode === "register"
                        ? "创建沙盒账户"
                        : "登录沙盒账户"}
                  </button>
                </div>
              )}
            </Panel>

            <Panel title={databaseReady ? "Stripe 充值 V 币" : "沙盒充值 V 币"}>
              <div className="grid gap-3">
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label="金额" value={String(amountFiat)} onChange={(value) => setAmountFiat(Number(value) || 0)} type="number" />
                  <Field label="币种" value={currency} onChange={(value) => setCurrency(value.toUpperCase())} />
                </div>
                <button className="rounded-lg border border-[#18d5c6]/40 bg-[#18d5c6]/10 px-4 py-3 font-black text-[#18d5c6] disabled:opacity-50" disabled={!session.account || pending === "topup"} onClick={createTopup} type="button">
                  {databaseReady ? "创建 Checkout" : "立即入账"}
                </button>
              </div>
            </Panel>

            <Panel title="确认购买">
              <div className="grid gap-3">
                <div className="rounded-lg border border-[#18d5c6]/20 bg-[#18d5c6]/10 p-3">
                  <strong>{selectedProduct?.name ?? "请选择商品"}</strong>
                  <span className="mt-1 block text-sm text-[#9eb7bc]">
                    应付 {format(totalVcoin)} V · 库存 {selectedProduct?.stock ?? 0}
                  </span>
                </div>
                <Field label="数量" value={String(quantity)} onChange={(value) => setQuantity(Math.max(1, Number(value) || 1))} type="number" />
                <Field label="收货人 / 企业" value={receiverName} onChange={setReceiverName} />
                <Field label="收货 / 服务地址" value={address} onChange={setAddress} />
                <Field label="绑定电表 / 服务编号" value={meterNo} onChange={setMeterNo} />
                <button className="rounded-lg bg-[#18d5c6] px-4 py-3 font-black text-[#03171a] disabled:opacity-50" disabled={!session.account || !selectedProduct || pending === "purchase"} onClick={purchaseProduct} type="button">
                  确认 V币购买
                </button>
              </div>
            </Panel>

            <Panel title="我的订单">
              <div className="grid max-h-80 gap-3 overflow-auto pr-1">
                {orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/15 p-4 text-center text-sm text-[#9eb7bc]">
                    登录并购买后会出现订单记录。
                  </div>
                ) : (
                  orders.map((order) => (
                    <article className="rounded-lg border border-white/10 bg-white/5 p-3" key={order.id}>
                      <strong className="block text-sm">
                        {order.items.map((item) => `${item.productName} x ${item.quantity}`).join(" / ")}
                      </strong>
                      <span className="mt-1 block text-xs text-[#9eb7bc]">
                        {format(Number(order.totalVcoin))} V · {order.status}
                      </span>
                      <span className="mt-1 block text-xs text-[#9eb7bc]">
                        {new Date(order.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </article>
                  ))
                )}
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-xl border border-[#47e2db]/20 bg-[#0a1c2b]/80 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
      <span className="text-sm font-bold text-[#9eb7bc]">{label}</span>
      <strong className="mt-2 block text-2xl">{value}</strong>
      <em className="mt-1 block not-italic text-sm font-black text-[#18d5c6]">{note}</em>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#47e2db]/20 bg-[#0a1c2b]/80 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-[#9eb7bc]">{label}</span>
      <input
        className="w-full rounded-lg border border-white/10 bg-[#030c15]/70 px-3 py-3 text-white outline-none focus:border-[#18d5c6]"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function tabClass(active: boolean) {
  return `rounded-md px-3 py-2 text-sm font-black ${active ? "bg-white text-[#03171a]" : "text-white/70"}`;
}

function format(value: number) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function fiatToSandboxVcoin(amountFiat: number, currency: string) {
  const rate = currency.toUpperCase() === "CNY" ? 10 : 100;
  return Number((amountFiat * rate).toFixed(4));
}

function readSandboxState() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { session: SessionState; orders: MallOrder[] };
  } catch {
    return null;
  }
}

function writeSandboxState(session: SessionState, orders: MallOrder[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    SANDBOX_STORAGE_KEY,
    JSON.stringify({
      session,
      orders
    })
  );
}
