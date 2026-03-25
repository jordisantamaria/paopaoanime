"use server";

import { hash } from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/schema";

const resend = new Resend(process.env.AUTH_RESEND_KEY);
const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  if (!email) return { error: "メールアドレスを入力してください。" };

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to avoid leaking whether the email exists
  if (!user) return {};

  // Delete any existing tokens for this email
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, email));

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(verificationTokens).values({
    identifier: email,
    token,
    expires,
  });

  const resetUrl = `${BASE_URL}/login/reset?token=${token}&email=${encodeURIComponent(email)}`;

  await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM ?? "noreply@paopaoanime.com",
    to: email,
    subject: "パスワードリセット - PaoPaoAnime",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>パスワードリセット</h2>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
        <p><a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">パスワードをリセット</a></p>
        <p style="color: #888; font-size: 12px;">このリンクは1時間後に無効になります。<br/>心当たりがない場合は、このメールを無視してください。</p>
      </div>
    `,
  });

  return {};
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<{ error?: string }> {
  if (!email || !token || !newPassword) return { error: "入力が不足しています。" };
  if (newPassword.length < 8) return { error: "パスワードは8文字以上で入力してください。" };

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, token)))
    .limit(1);

  if (!row) return { error: "リンクが無効です。もう一度リセットをお試しください。" };
  if (row.expires < new Date()) return { error: "リンクの有効期限が切れています。もう一度リセットをお試しください。" };

  const hashed = await hash(newPassword, 12);

  await db
    .update(users)
    .set({ password: hashed })
    .where(eq(users.email, email));

  // Delete used token
  await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, token)));

  return {};
}
