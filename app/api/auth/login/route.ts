import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie, publicAccount, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱。").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "请输入密码。")
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const account = await prisma.account.findUnique({
      where: { email: body.email }
    });

    if (!account || !verifyPassword(body.password, account.passwordHash)) {
      return NextResponse.json({ error: "邮箱或密码不正确。" }, { status: 401 });
    }

    const response = NextResponse.json({ account: publicAccount(account) });
    await createSessionCookie(response, account.id);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录失败。" },
      { status: 400 }
    );
  }
}
