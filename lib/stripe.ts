import { createHmac, timingSafeEqual } from "node:crypto";

type StripeCheckoutInput = {
  topupId: string;
  accountId: string;
  amountFiat: number;
  amountVcoin: number;
  currency: string;
};

type StripeCheckoutSession = {
  id: string;
  url: string;
};

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function fiatToVcoin(amountFiat: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const envKey = `VCOIN_PER_${normalizedCurrency}`;
  const rate = Number(process.env[envKey] ?? process.env.VCOIN_PER_USD ?? 100);
  return Number((amountFiat * rate).toFixed(4));
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput
): Promise<StripeCheckoutSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("缺少 STRIPE_SECRET_KEY，无法创建真实支付。");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:4173";
  const successUrl =
    process.env.STRIPE_SUCCESS_URL ?? `${appUrl}/mall?topup=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${appUrl}/mall?topup=cancelled`;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("client_reference_id", input.topupId);
  params.set("metadata[topupId]", input.topupId);
  params.set("metadata[accountId]", input.accountId);
  params.set("metadata[amountVcoin]", String(input.amountVcoin));
  params.set("payment_intent_data[metadata][topupId]", input.topupId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(Math.round(input.amountFiat * 100))
  );
  params.set("line_items[0][price_data][product_data][name]", "VOLT+ V 币充值");
  params.set(
    "line_items[0][price_data][product_data][description]",
    `${input.amountVcoin.toLocaleString("zh-CN")} V 币`
  );

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = (await response.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.id || !data.url) {
    throw new Error(data.error?.message ?? "Stripe Checkout 创建失败。");
  }

  return {
    id: data.id,
    url: data.url
  };
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("缺少 STRIPE_WEBHOOK_SECRET，无法验签 Stripe webhook。");
  }
  if (!signatureHeader) {
    throw new Error("缺少 Stripe-Signature。");
  }

  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) {
    throw new Error("Stripe-Signature 格式不正确。");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("Stripe webhook 验签失败。");
  }

  return JSON.parse(rawBody) as StripeWebhookEvent;
}

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: string;
      client_reference_id?: string;
      metadata?: Record<string, string | undefined>;
    };
  };
};
