import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpActionGeneric, httpRouter } from "convex/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    let event;
    try {
      event = await verifyWebhook(request, {
        signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
      });
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const primaryEmail = event.data.email_addresses.find(
        (email) => email.id === event.data.primary_email_address_id,
      );
      if (!primaryEmail) {
        return new Response("Verified user has no primary email", {
          status: 422,
        });
      }

      const displayName =
        [event.data.first_name, event.data.last_name]
          .filter(Boolean)
          .join(" ") || primaryEmail.email_address;

      await ctx.runMutation(internal.users.upsertFromClerk, {
        clerkUserId: event.data.id,
        displayName,
        normalizedEmail: primaryEmail.email_address.toLowerCase(),
        role: "requester",
        isActive: true,
        timezone: "UTC",
      });
    }

    return new Response("Webhook accepted", { status: 200 });
  }),
});

export default http;
