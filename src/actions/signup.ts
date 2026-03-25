"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

export async function signup(email: string, password: string): Promise<{ error?: string }> {
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };
  if (password.length < 8) return { error: "パスワードは8文字以上で入力してください。" };

  const [existing] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "このメールアドレスは既に登録されています。" };
  }

  const hashed = await hash(password, 12);
  await db.insert(users).values({
    email,
    password: hashed,
  });

  return {};
}
