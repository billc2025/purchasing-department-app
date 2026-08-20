"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export type Language = "en" | "es";

const copy = {
  en: {
    language: "Language",
    english: "English",
    spanish: "Español",
    purchasingHub: "Purchasing Hub",
    purchasingBucket: "Purchasing bucket",
    myOrders: "My orders",
    newOrder: "New order",
    welcome: "Welcome",
    startHere: "Start here",
    placeNewOrder: "Place a new order",
    placeNewOrderHelp:
      "Save a draft, add several items, check the deadline, and submit.",
    yourActivity: "Your activity",
    reviewOrders: "Review my orders",
    reviewOrdersHelp:
      "Track drafts, compliant requests, and requests awaiting exception review.",
    liveOperations: "Live operations",
    bucketHelp: "Claim and prioritize submitted purchasing work in real time.",
    developmentData: "Development sample data",
    addSampleData: "Add sample data",
    developmentDataHelp:
      "Adds editable Food Delivery (1 hour), Event Purchase (3 days), General Operations, and Main Office examples.",
    primaryNavigation: "Primary navigation",
    purchasingActivity: "Purchasing activity",
    noOrders: "You have not placed an order yet.",
    due: "Due",
    client: "Client",
    internalCost: "Internal cost",
    loadingOrders: "Loading your orders…",
    loadingOrder: "Loading order…",
    requestedFor: "Requested for",
    createdBy: "Created by",
    neededBy: "Needed by",
    billing: "Billing",
    totalOrderBudget: "Total order budget",
    leadTime: "Lead time",
    lateReview: "Late — exception review required",
    compliant: "Compliant",
    items: "Items",
    preferredVendor: "Preferred vendor",
    noPreference: "No preference",
    estimatedItemCost: "Estimated item cost",
    quantity: "Quantity",
    comments: "Comments",
    overlordControls: "Overlord controls",
    cancellationPreserves:
      "Cancellation preserves this order and its complete audit history.",
    cancelOrder: "Cancel order",
    cancellationReason: "Required cancellation reason",
    confirmCancellation: "Confirm cancellation",
    keepOrder: "Keep order",
    cancelledPreserved: "Order cancelled. History was preserved.",
    unableCancel: "Unable to cancel order",
    bucketTitle: "Purchasing bucket",
    bucketSubtitle: "Prioritized automatically and updated without refreshing.",
    searchOrders: "Search orders",
    searchPlaceholder: "Order, requester, category, or location",
    view: "View",
    readOnly:
      "Read-only access: your role can monitor this bucket but cannot change assignments.",
    noBucketOrders: "No orders match this view.",
    previous: "Previous",
    next: "Next",
    order: "Order",
    details: "Details",
    assignment: "Assignment",
    status: "Status",
    actions: "Actions",
    unassigned: "Unassigned",
    draft: "Draft",
    assigned: "Assigned",
    inReview: "In review",
    approvedToPurchase: "Approved to purchase",
    purchasing: "Purchasing",
    purchased: "Purchased",
    inTransit: "In transit",
    received: "Received",
    rejected: "Rejected",
    cancellationRequested: "Cancellation requested",
    receiptIssue: "Receipt issue reported",
    assignedToMe: "Assigned to Me",
    allActive: "All Active",
    dueToday: "Due Today",
    upcoming: "Upcoming",
    waitingRequester: "Waiting for Requester",
    exceptionPending: "Exception Pending",
    readyReception: "Ready for Reception",
    partiallyFulfilled: "Partially Fulfilled",
    overdue: "Overdue",
    late: "Late",
    completed: "Completed",
    cancelled: "Cancelled",
    missingInformation: "Missing information",
    claim: "Claim",
    release: "Release",
    reassign: "Reassign",
    releaseOrder: "Release order",
    reassignOrder: "Reassign order",
    purchasingAgent: "Purchasing agent",
    selectAgent: "Select agent",
    requiredReason: "Required reason",
    confirm: "Confirm",
    cancel: "Cancel",
    remaining: "remaining",
    orders: "orders",
    category: "Category",
    requesterLocation: "Requester / location",
    loadingBucket: "Loading purchasing bucket…",
    claimedMessage: "Order claimed. The bucket updated for everyone.",
    unableClaim: "Unable to claim order",
    releasedMessage: "Order released to the unassigned bucket.",
    reassignedMessage: "Order reassigned.",
    unableAssignment: "Unable to update assignment",
    requested: "Requested",
    underReview: "Under review",
    informationNeeded: "Information needed",
    approved: "Approved",
    ordered: "Ordered",
    substituted: "Substituted",
    unavailable: "Unavailable",
    returned: "Returned",
    refunded: "Refunded",
  },
  es: {
    language: "Idioma",
    english: "English",
    spanish: "Español",
    purchasingHub: "Centro de Compras",
    purchasingBucket: "Bandeja de compras",
    myOrders: "Mis pedidos",
    newOrder: "Nuevo pedido",
    welcome: "Bienvenido",
    startHere: "Comience aquí",
    placeNewOrder: "Crear un nuevo pedido",
    placeNewOrderHelp:
      "Guarde un borrador, agregue artículos, revise la fecha límite y envíelo.",
    yourActivity: "Su actividad",
    reviewOrders: "Revisar mis pedidos",
    reviewOrdersHelp:
      "Consulte borradores, solicitudes conformes y solicitudes pendientes de excepción.",
    liveOperations: "Operaciones en vivo",
    bucketHelp: "Asigne y priorice solicitudes de compra en tiempo real.",
    developmentData: "Datos de ejemplo para desarrollo",
    addSampleData: "Agregar datos de ejemplo",
    developmentDataHelp:
      "Agrega ejemplos editables de Entrega de comida (1 hora), Compra para eventos (3 días), Operaciones generales y Oficina principal.",
    primaryNavigation: "Navegación principal",
    purchasingActivity: "Actividad de compras",
    noOrders: "Aún no ha realizado ningún pedido.",
    due: "Fecha límite",
    client: "Cliente",
    internalCost: "Costo interno",
    loadingOrders: "Cargando sus pedidos…",
    loadingOrder: "Cargando pedido…",
    requestedFor: "Solicitado para",
    createdBy: "Creado por",
    neededBy: "Necesario para",
    billing: "Facturación",
    totalOrderBudget: "Presupuesto total del pedido",
    leadTime: "Tiempo de anticipación",
    lateReview: "Tardío — requiere revisión de excepción",
    compliant: "Conforme",
    items: "Artículos",
    preferredVendor: "Proveedor preferido",
    noPreference: "Sin preferencia",
    estimatedItemCost: "Costo estimado del artículo",
    quantity: "Cantidad",
    comments: "Comentarios",
    overlordControls: "Controles de Overlord",
    cancellationPreserves:
      "La cancelación conserva este pedido y todo su historial de auditoría.",
    cancelOrder: "Cancelar pedido",
    cancellationReason: "Motivo obligatorio de cancelación",
    confirmCancellation: "Confirmar cancelación",
    keepOrder: "Conservar pedido",
    cancelledPreserved: "Pedido cancelado. Se conservó el historial.",
    unableCancel: "No se pudo cancelar el pedido",
    bucketTitle: "Bandeja de compras",
    bucketSubtitle: "Se prioriza automáticamente y se actualiza sin recargar.",
    searchOrders: "Buscar pedidos",
    searchPlaceholder: "Pedido, solicitante, categoría o ubicación",
    view: "Vista",
    readOnly:
      "Acceso de solo lectura: su rol puede supervisar esta bandeja, pero no cambiar asignaciones.",
    noBucketOrders: "Ningún pedido coincide con esta vista.",
    previous: "Anterior",
    next: "Siguiente",
    order: "Pedido",
    details: "Detalles",
    assignment: "Asignación",
    status: "Estado",
    actions: "Acciones",
    unassigned: "Sin asignar",
    draft: "Borrador",
    assigned: "Asignado",
    inReview: "En revisión",
    approvedToPurchase: "Aprobado para comprar",
    purchasing: "En compra",
    purchased: "Comprado",
    inTransit: "En tránsito",
    received: "Recibido",
    rejected: "Rechazado",
    cancellationRequested: "Cancelación solicitada",
    receiptIssue: "Problema de recepción reportado",
    assignedToMe: "Asignados a mí",
    allActive: "Todos activos",
    dueToday: "Para hoy",
    upcoming: "Próximos",
    waitingRequester: "Esperando al solicitante",
    exceptionPending: "Excepción pendiente",
    readyReception: "Listos para recepción",
    partiallyFulfilled: "Parcialmente completados",
    overdue: "Vencidos",
    late: "Tardío",
    completed: "Completados",
    cancelled: "Cancelados",
    missingInformation: "Falta información",
    claim: "Asignarme",
    release: "Liberar",
    reassign: "Reasignar",
    releaseOrder: "Liberar pedido",
    reassignOrder: "Reasignar pedido",
    purchasingAgent: "Agente de compras",
    selectAgent: "Seleccione un agente",
    requiredReason: "Motivo obligatorio",
    confirm: "Confirmar",
    cancel: "Cancelar",
    remaining: "restantes",
    orders: "pedidos",
    category: "Categoría",
    requesterLocation: "Solicitante / ubicación",
    loadingBucket: "Cargando la bandeja de compras…",
    claimedMessage: "Pedido asignado. La bandeja se actualizó para todos.",
    unableClaim: "No se pudo asignar el pedido",
    releasedMessage: "Pedido liberado a la bandeja sin asignar.",
    reassignedMessage: "Pedido reasignado.",
    unableAssignment: "No se pudo actualizar la asignación",
    requested: "Solicitado",
    underReview: "En revisión",
    informationNeeded: "Información necesaria",
    approved: "Aprobado",
    ordered: "Ordenado",
    substituted: "Sustituido",
    unavailable: "No disponible",
    returned: "Devuelto",
    refunded: "Reembolsado",
  },
} as const;

type CopyKey = keyof (typeof copy)["en"];

type LanguageContextValue = {
  language: Language;
  locale: string;
  t: (key: CopyKey) => string;
  formatDate: (value: number) => string;
  formatCurrency: (amountMinor: number, currency: string) => string;
  statusLabel: (status: string) => string;
  setLanguage: (language: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: ReactNode;
}) {
  const [language, setLocalLanguage] = useState(initialLanguage);
  const saveLanguage = useMutation(api.users.setPreferredLanguage);
  return (
    <LanguageContext.Provider
      value={{
        language,
        locale: language === "es" ? "es-PA" : "en-US",
        t: (key) => copy[language][key],
        formatDate: (value) =>
          new Intl.DateTimeFormat(language === "es" ? "es-PA" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(value),
        formatCurrency: (amountMinor, currency) =>
          new Intl.NumberFormat(language === "es" ? "es-PA" : "en-US", {
            style: "currency",
            currency,
          }).format(amountMinor / 100),
        statusLabel: (status) => {
          const labels: Record<string, CopyKey> = {
            draft: "draft",
            unassigned: "unassigned",
            assigned: "assigned",
            in_review: "inReview",
            waiting_for_requester: "waitingRequester",
            exception_pending: "exceptionPending",
            approved_to_purchase: "approvedToPurchase",
            purchasing: "purchasing",
            ready_for_reception: "readyReception",
            partially_fulfilled: "partiallyFulfilled",
            purchased: "purchased",
            in_transit: "inTransit",
            received: "received",
            completed: "completed",
            rejected: "rejected",
            cancellation_requested: "cancellationRequested",
            receipt_issue_reported: "receiptIssue",
            cancelled: "cancelled",
            requested: "requested",
            under_review: "underReview",
            information_needed: "informationNeeded",
            approved: "approved",
            ordered: "ordered",
            substituted: "substituted",
            unavailable: "unavailable",
            returned: "returned",
            refunded: "refunded",
          };
          const key = labels[status];
          return key ? copy[language][key] : status.replaceAll("_", " ");
        },
        setLanguage: async (nextLanguage) => {
          setLocalLanguage(nextLanguage);
          try {
            await saveLanguage({ language: nextLanguage });
          } catch (error) {
            setLocalLanguage(language);
            throw error;
          }
        },
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required");
  return value;
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="text-xs text-muted-foreground">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        className="rounded-md border bg-background px-2 py-2 text-sm text-foreground"
        value={language}
        onChange={(event) => void setLanguage(event.target.value as Language)}
      >
        <option value="en">{t("english")}</option>
        <option value="es">{t("spanish")}</option>
      </select>
    </label>
  );
}
