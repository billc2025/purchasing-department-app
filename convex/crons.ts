import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "order deadline notifications",
  { hours: 1 },
  internal.notifications.generateDeadlineAlerts,
);
export default crons;
