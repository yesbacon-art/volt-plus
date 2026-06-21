import { NextResponse } from "next/server";
import { listMallProducts } from "@/lib/mall";

export async function GET() {
  try {
    const products = await listMallProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "商品读取失败。" },
      { status: 500 }
    );
  }
}
