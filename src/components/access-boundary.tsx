"use client";

import { Component, type ReactNode } from "react";

type State = { error: Error | null };

export class AccountAccessBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch() {
    // The backend emits safe account-state codes; do not log identity details.
  }

  render() {
    if (!this.state.error) return this.props.children;
    const inactive = this.state.error.message.includes("ACCOUNT_INACTIVE");
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <section className="max-w-md rounded-xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">
            {inactive ? "Account inactive" : "Account awaiting access"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {inactive
              ? "Your account has been deactivated. Contact an administrator."
              : "Your invited account has not been provisioned in Purchasing Hub yet."}
          </p>
        </section>
      </main>
    );
  }
}
