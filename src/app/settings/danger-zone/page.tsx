import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";

export const dynamic = "force-dynamic";

export default async function DangerZonePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <DeleteAccountForm />;
}
