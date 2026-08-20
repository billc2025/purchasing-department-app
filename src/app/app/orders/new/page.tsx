import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function NewOrderPage() {
  await auth.protect();
  return <AppShell view="new" />;
}
