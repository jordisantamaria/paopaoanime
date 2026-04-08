import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlatformPreferences } from "@/actions/platform-preferences";
import { PlatformSettings } from "@/components/platform-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const preferredPlatforms = await getPlatformPreferences();

  return <PlatformSettings initialPreferences={preferredPlatforms} />;
}
