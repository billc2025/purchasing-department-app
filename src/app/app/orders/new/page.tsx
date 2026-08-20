import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  await auth.protect();
  const { orderId } = await searchParams;
  return <AppShell view="new" orderId={orderId} />;
}
