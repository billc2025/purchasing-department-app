"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export class ReportsErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <section className="rounded-2xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Report unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The report could not be loaded. Narrow the date range or refresh and
            try again.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </Button>
        </section>
      );
    return this.props.children;
  }
}
