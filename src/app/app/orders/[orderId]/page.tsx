import { AppShell } from "@/components/app-shell";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <AppShell view="detail" orderId={orderId} />;
}
