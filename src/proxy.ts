import { clerkMiddleware } from "@clerk/nextjs/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexWebSocketUrl = convexUrl?.replace(/^http/, "ws");

export default clerkMiddleware({
  contentSecurityPolicy: {
    directives: {
      "connect-src": [convexUrl, convexWebSocketUrl].filter(
        (source): source is string => Boolean(source),
      ),
    },
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
