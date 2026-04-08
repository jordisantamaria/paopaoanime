import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlatformPreferences } from "@/actions/platform-preferences";
import { PlatformSettings } from "@/components/platform-settings";
import { ChangeNameForm } from "@/components/change-name-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const preferredPlatforms = await getPlatformPreferences();

  return (
    <div className="space-y-8">
      <ChangeNameForm initialName={session.user.name ?? ""} />
      <div className="border-t border-border pt-8">
        <PlatformSettings initialPreferences={preferredPlatforms} />
      </div>
    </div>
  );
}
