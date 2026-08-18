import { AppShell } from "@/components/app-shell";

export default function ApplicationPage() {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.NEXT_PUBLIC_CONVEX_URL
  ) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="rounded-xl border p-8 text-muted-foreground">
          Clerk and Convex development configuration is required.
        </p>
      </main>
    );
  }
  return <AppShell />;
}
