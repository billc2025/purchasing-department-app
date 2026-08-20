import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );

  return (
    <main
      id="main-content"
      className="grid min-h-screen place-items-center bg-muted/30 px-4 sm:px-6"
    >
      <section className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal purchasing
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Purchasing Hub
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          A secure workspace for purchasing requests, fulfillment, receipt, and
          audit history.
        </p>
        {configured ? (
          <Link
            className={buttonVariants({ className: "mt-8" })}
            href="/sign-in"
          >
            Sign in
          </Link>
        ) : (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            External services are not configured. Follow the Phase 1 setup
            instructions in the README.
          </div>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          Accounts are invitation-only. Public registration is unavailable.
        </p>
      </section>
    </main>
  );
}
