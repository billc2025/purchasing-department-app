import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function OrdersPage() {
  await auth.protect();
  return <AppShell view="mine" />;
}
