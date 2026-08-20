/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as configuration from "../configuration.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_bucket from "../lib/bucket.js";
import type * as lib_orderValidation from "../lib/orderValidation.js";
import type * as lib_reporting from "../lib/reporting.js";
import type * as lifecycle from "../lifecycle.js";
import type * as orders from "../orders.js";
import type * as processing from "../processing.js";
import type * as purchasing from "../purchasing.js";
import type * as reports from "../reports.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  configuration: typeof configuration;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/authorization": typeof lib_authorization;
  "lib/bucket": typeof lib_bucket;
  "lib/orderValidation": typeof lib_orderValidation;
  "lib/reporting": typeof lib_reporting;
  lifecycle: typeof lifecycle;
  orders: typeof orders;
  processing: typeof processing;
  purchasing: typeof purchasing;
  reports: typeof reports;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
