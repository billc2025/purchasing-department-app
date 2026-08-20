"use client";

import { UserButton } from "@clerk/nextjs";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AccountAccessBoundary } from "@/components/access-boundary";
import { Button } from "@/components/ui/button";
import { MyOrders } from "@/components/my-orders";
import { OrderEntry } from "@/components/order-entry";
import { OrderDetail } from "@/components/order-detail";
import { PurchasingBucket } from "@/components/purchasing-bucket";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { ReportsErrorBoundary } from "@/components/reports-error-boundary";
import { NotificationCenter } from "@/components/notification-center";
import { ConfigurationWorkspace } from "@/components/configuration-workspace";
import {
  LanguageProvider,
  LanguageSelector,
  useLanguage,
} from "@/components/language-provider";

type View =
  | "dashboard"
  | "new"
  | "mine"
  | "detail"
  | "purchasing"
  | "reports"
  | "settings";

function Workspace({ view, orderId }: { view: View; orderId?: string }) {
  const profile = useQuery(api.users.current);
  if (profile === undefined)
    return <StateCard title="Loading your workspace…" />;
  return (
    <LanguageProvider initialLanguage={profile.preferredLanguage}>
      <WorkspaceContent profile={profile} view={view} orderId={orderId} />
    </LanguageProvider>
  );
}

function WorkspaceContent({
  profile,
  view,
  orderId,
}: {
  profile: {
    displayName: string;
    canAccessSystemControl: boolean;
    canViewPurchasingBucket: boolean;
    canViewReports: boolean;
    canManageConfiguration: boolean;
  };
  view: View;
  orderId?: string;
}) {
  const seed = useMutation(api.configuration.seedDevelopmentExamples);
  const resetOrders = useMutation(api.configuration.resetDevelopmentOrders);
  const { t, language } = useLanguage();
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const resetCopy =
    language === "es"
      ? {
          title: "Restablecer pedidos de prueba",
          help: "Elimina permanentemente todos los pedidos y su historial operativo. Conserva usuarios, roles, categorías, ubicaciones y configuración.",
          instruction: "Escriba DELETE TEST ORDERS para confirmar",
          button: "Eliminar todos los pedidos de prueba",
          success: "Todos los pedidos de prueba fueron eliminados.",
          failed: "No se pudieron eliminar los pedidos de prueba.",
        }
      : {
          title: "Reset test orders",
          help: "Permanently deletes every order and its operational history. Users, roles, categories, locations, and settings are preserved.",
          instruction: "Type DELETE TEST ORDERS to confirm",
          button: "Delete all test orders",
          success: "All test orders were deleted.",
          failed: "The test orders could not be deleted.",
        };
  return (
    <main
      id="main-content"
      className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <Link
            href="/app"
            className="text-sm font-semibold text-muted-foreground"
          >
            {t("purchasingHub")}
          </Link>
          <h1 className="text-2xl font-semibold">
            {t("welcome")}, {profile.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <nav
            aria-label={t("primaryNavigation")}
            className="flex flex-wrap justify-end gap-2 text-sm"
          >
            {profile.canViewPurchasingBucket && (
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/app/purchasing"
              >
                {t("purchasingBucket")}
              </Link>
            )}
            {profile.canViewReports && (
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/app/reports"
              >
                {language === "es" ? "Reportes" : "Reports"}
              </Link>
            )}
            {profile.canManageConfiguration && (
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/app/settings"
              >
                {language === "es" ? "Configuración" : "Settings"}
              </Link>
            )}
            <Link
              className="rounded-md px-3 py-2 hover:bg-muted"
              href="/app/orders"
            >
              {t("myOrders")}
            </Link>
            <Link
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
              href="/app/orders/new"
            >
              {t("newOrder")}
            </Link>
          </nav>
          <NotificationCenter />
          <LanguageSelector />
          <UserButton />
        </div>
      </header>
      <section className="py-8">
        {view === "new" && <OrderEntry />}
        {view === "mine" && <MyOrders />}
        {view === "detail" && orderId && <OrderDetail orderId={orderId} />}
        {view === "purchasing" && <PurchasingBucket />}
        {view === "reports" &&
          (profile.canViewReports ? (
            <ReportsErrorBoundary>
              <ReportsDashboard />
            </ReportsErrorBoundary>
          ) : (
            <StateCard
              title={language === "es" ? "Acceso denegado" : "Access denied"}
              detail={
                language === "es"
                  ? "Su función no tiene acceso a los reportes administrativos."
                  : "Your role does not have access to administrative reports."
              }
            />
          ))}
        {view === "settings" &&
          (profile.canManageConfiguration ? (
            <ConfigurationWorkspace />
          ) : (
            <StateCard
              title={language === "es" ? "Acceso denegado" : "Access denied"}
            />
          ))}
        {view === "dashboard" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Link
              href="/app/orders/new"
              className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
            >
              <p className="text-sm text-muted-foreground">{t("startHere")}</p>
              <h2 className="mt-1 text-xl font-semibold">
                {t("placeNewOrder")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("placeNewOrderHelp")}
              </p>
            </Link>
            <Link
              href="/app/orders"
              className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
            >
              <p className="text-sm text-muted-foreground">
                {t("yourActivity")}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {t("reviewOrders")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("reviewOrdersHelp")}
              </p>
            </Link>
            {profile.canAccessSystemControl && (
              <div className="rounded-2xl border border-dashed p-7">
                <h2 className="text-lg font-semibold">
                  {t("developmentData")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("developmentDataHelp")}
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => seed()}
                >
                  {t("addSampleData")}
                </Button>
                <div className="mt-6 border-t border-red-200 pt-5">
                  <h3 className="font-semibold text-red-900">
                    {resetCopy.title}
                  </h3>
                  <p className="mt-2 text-sm text-red-800">{resetCopy.help}</p>
                  <label className="mt-3 block text-sm text-red-950">
                    {resetCopy.instruction}
                    <input
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                      autoComplete="off"
                      value={resetPhrase}
                      onChange={(event) => setResetPhrase(event.target.value)}
                    />
                  </label>
                  <Button
                    className="mt-3"
                    variant="destructive"
                    disabled={resetBusy || resetPhrase !== "DELETE TEST ORDERS"}
                    onClick={async () => {
                      setResetBusy(true);
                      setResetMessage("");
                      try {
                        await resetOrders({ confirmation: resetPhrase });
                        setResetPhrase("");
                        setResetMessage(resetCopy.success);
                      } catch (error) {
                        setResetMessage(
                          error instanceof Error
                            ? error.message
                            : resetCopy.failed,
                        );
                      } finally {
                        setResetBusy(false);
                      }
                    }}
                  >
                    {resetCopy.button}
                  </Button>
                  {resetMessage && (
                    <p className="mt-3 text-sm" role="status">
                      {resetMessage}
                    </p>
                  )}
                </div>
              </div>
            )}
            {profile.canViewPurchasingBucket && (
              <Link
                href="/app/purchasing"
                className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
              >
                <p className="text-sm text-muted-foreground">
                  {t("liveOperations")}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {t("purchasingBucket")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("bucketHelp")}
                </p>
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function StateCard({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md rounded-xl border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {detail && (
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        )}
      </section>
    </main>
  );
}

export function AppShell({
  view = "dashboard",
  orderId,
}: {
  view?: View;
  orderId?: string;
}) {
  return (
    <>
      <AuthLoading>
        <StateCard title="Verifying access…" />
      </AuthLoading>
      <Authenticated>
        <AccountAccessBoundary>
          <Workspace view={view} orderId={orderId} />
        </AccountAccessBoundary>
      </Authenticated>
      <Unauthenticated>
        <StateCard
          title="Access denied"
          detail="Sign in with an invited account to continue."
        />
      </Unauthenticated>
    </>
  );
}
