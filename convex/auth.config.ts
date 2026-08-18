import type { AuthConfig } from "convex/server";

const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!issuerDomain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN must be configured in Convex");
}

export default {
  providers: [{ domain: issuerDomain, applicationID: "convex" }],
} satisfies AuthConfig;
