import { AppShell } from "@/components/app-shell";
import { auth } from "@clerk/nextjs/server";

export default async function ApprovalsPage() {
  await auth.protect();
  return <AppShell view="approvals" />;
}
