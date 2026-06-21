import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie, hashPassword, publicAccount } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const registerSchema = z.object({
  email: z.string().email("请输入有效邮箱。").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "密码至少需要 8 位。").max(128),
  displayName: z.string().min(2, "请输入昵称或企业名。").max(80)
});

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "账户注册需要先配置 DATABASE_URL 并执行 Prisma 迁移。" },
        { status: 503 }
      );
    }

    const body = registerSchema.parse(await request.json());
    const account = await prisma.account.create({
      data: {
        email: body.email,
        displayName: body.displayName,
        passwordHash: hashPassword(body.password),
        wallet: {
          create: {
            vcoinAvailable: 0,
            vcoinReserved: 0,
            tokenBalance: 0
          }
        }
      }
    });

    const response = NextResponse.json({ account: publicAccount(account) });
    await createSessionCookie(response, account.id);
    return response;
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return NextResponse.json({ error: "该邮箱已注册，可以直接登录。" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败。" },
      { status: 400 }
    );
  }
}

function isUniqueEmailError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
