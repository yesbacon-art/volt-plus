import { createId } from "@/lib/id";
import type { PriceTick } from "@/lib/types";

const BASE_PRICE = 0.724;
const BASE_LOAD = 6240;

export function createPriceTick(sequence = Date.now()): PriceTick {
  const wave = Math.sin(sequence / 18_000);
  const fastWave = Math.cos(sequence / 7_000);
  const price = BASE_PRICE + wave * 0.082 + fastWave * 0.028;
  const previous = BASE_PRICE + Math.sin((sequence - 2_000) / 18_000) * 0.082;

  return {
    id: createId("tick"),
    timestamp: new Date().toISOString(),
    priceCnyKwh: round(price, 3),
    gridLoadMw: Math.round(BASE_LOAD + wave * 380 + fastWave * 145),
    renewableShare: Math.max(18, Math.min(72, Math.round(44 + fastWave * 14))),
    trend: price > previous + 0.005 ? "up" : price < previous - 0.005 ? "down" : "flat"
  };
}

export function seedPriceTicks(count = 24) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) =>
    createPriceTick(now - (count - index) * 90_000)
  );
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function cnyToVcoin(amountCny: number) {
  return round(amountCny * 10, 2);
}

export function vcoinForPower(quantityKwh: number, priceCnyKwh: number) {
  return cnyToVcoin(quantityKwh * priceCnyKwh);
}
