import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await auth.protect();
  const { orderId } = await params;
  return <AppShell view="detail" orderId={orderId} />;
}
