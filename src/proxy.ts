import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexWebSocketUrl = convexUrl?.replace(/^http/, "ws");

const authenticatedProxy = clerkMiddleware({
  contentSecurityPolicy: {
    directives: {
      "connect-src": [convexUrl, convexWebSocketUrl].filter(
        (source): source is string => Boolean(source),
      ),
    },
  },
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    return NextResponse.next();
  return authenticatedProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
