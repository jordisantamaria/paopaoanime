import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlatformPreferences } from "@/actions/platform-preferences";
import { PlatformSettings } from "@/components/platform-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const preferredPlatforms = await getPlatformPreferences();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-bold">設定</h1>
      <PlatformSettings initialPreferences={preferredPlatforms} />
    </div>
  );
}
