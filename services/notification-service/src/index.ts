import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { startConsumer } from "./consumer";
import { registerClient, unregisterClient } from "./ws";

const healthSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Suilens Notification Service API",
          version: "1.0.0",
          description:
            "Notification service for health checks and real-time WebSocket updates.",
        },
        tags: [
          { name: "Health", description: "Service health check endpoint" },
          {
            name: "WebSocket",
            description:
              "Real-time notification stream is available through the WS /ws endpoint.",
          },
        ],
      },
      path: "/docs",
    }),
  )
  .get("/health", () => ({ status: "ok", service: "notification-service" }), {
    detail: {
      summary: "Service health check",
      description: "Returns the health status of the notification service.",
      tags: ["Health"],
    },
    response: {
      200: healthSchema,
    },
  })
  .ws("/ws", {
    open(ws) {
      registerClient(ws);
      ws.send(
        JSON.stringify({
          type: "connection.ready",
          timestamp: new Date().toISOString(),
          data: {
            message: "Connected to notification stream",
          },
        }),
      );
    },
    close(ws) {
      unregisterClient(ws);
    },
  })
  .listen(3003);

startConsumer().catch(console.error);

console.log(`Notification Service running on port ${app.server?.port}`);
