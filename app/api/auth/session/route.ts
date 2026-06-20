import { NextResponse } from "next/server";
import { getCurrentAccount, publicAccount } from "@/lib/auth";

export async function GET() {
  const account = await getCurrentAccount();
  return NextResponse.json({
    account: account ? publicAccount(account) : null,
    wallet: account?.wallet ?? null
  });
}
