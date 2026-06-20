import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "volt_session";
const SESSION_DAYS = 30;
export type PublicAccount = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  kycStatus: string;
};

export { hashPassword, verifyPassword };

export function publicAccount(account: {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  kycStatus: string;
}): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    phone: account.phone,
    displayName: account.displayName,
    kycStatus: account.kycStatus
  };
}

export async function getCurrentAccount() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      account: {
        include: {
          wallet: true
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return session.account;
}

export async function requireCurrentAccount() {
  const account = await getCurrentAccount();
  if (!account) {
    throw new Error("请先登录账户。");
  }
  return account;
}

export async function createSessionCookie(response: NextResponse, accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      accountId,
      tokenHash: hashSessionToken(token),
      expiresAt
    }
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSessionCookie(response: NextResponse) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .delete({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => undefined);
  }

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
