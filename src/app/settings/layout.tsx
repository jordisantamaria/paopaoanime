import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">設定</h1>
      <SettingsNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
