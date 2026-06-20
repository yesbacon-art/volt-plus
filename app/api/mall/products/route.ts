import { NextResponse } from "next/server";
import { listMallProducts } from "@/lib/mall";

export async function GET() {
  const products = await listMallProducts();
  return NextResponse.json({ products });
}
