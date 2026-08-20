import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function PurchasingBucketPage() {
  await auth.protect();
  return <AppShell view="purchasing" />;
}
