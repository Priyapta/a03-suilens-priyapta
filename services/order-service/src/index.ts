import { Elysia, t, type Static } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { orders } from "./db/schema";
import { eq } from "drizzle-orm";
import { publishEvent } from "./events";

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3001";

interface CatalogLens {
  id: string;
  modelName: string;
  manufacturerName: string;
  dayPrice: string;
}

const lensSnapshotSchema = t.Object({
  modelName: t.String(),
  manufacturerName: t.String(),
  dayPrice: t.String(),
});

const orderSchema = t.Object({
  id: t.String({ format: "uuid" }),
  customerName: t.String(),
  customerEmail: t.String({ format: "email" }),
  lensId: t.String({ format: "uuid" }),
  lensSnapshot: lensSnapshotSchema,
  startDate: t.String({ format: "date-time" }),
  endDate: t.String({ format: "date-time" }),
  totalPrice: t.String(),
  status: t.Union([
    t.Literal("pending"),
    t.Literal("confirmed"),
    t.Literal("active"),
    t.Literal("returned"),
    t.Literal("cancelled"),
  ]),
  createdAt: t.String({ format: "date-time" }),
});

const createOrderBodySchema = t.Object({
  customerName: t.String(),
  customerEmail: t.String({ format: "email" }),
  lensId: t.String({ format: "uuid" }),
  startDate: t.String({
    format: "date",
    examples: ["2025-03-01"],
  }),
  endDate: t.String({
    format: "date",
    examples: ["2025-03-05"],
  }),
});

const errorSchema = t.Object({
  error: t.String(),
});

const healthSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

type CreateOrderBody = Static<typeof createOrderBodySchema>;
type OrderParams = { id: string };
type LensSnapshot = Static<typeof lensSnapshotSchema>;

function serializeOrder(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  lensId: string;
  lensSnapshot: unknown;
  startDate: Date;
  endDate: Date;
  totalPrice: string;
  status: "pending" | "confirmed" | "active" | "returned" | "cancelled";
  createdAt: Date;
}) {
  return {
    ...order,
    lensSnapshot: order.lensSnapshot as LensSnapshot,
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    createdAt: order.createdAt.toISOString(),
  };
}

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Suilens Order Service API",
          version: "1.0.0",
          description:
            "Order management API for creating and retrieving Suilens rental orders.",
        },
        tags: [
          { name: "Orders", description: "Order creation and retrieval endpoints" },
          { name: "Health", description: "Service health check endpoint" },
        ],
      },
      path: "/docs",
    }),
  )
  .post(
    "/api/orders",
    async ({ body, status }: { body: CreateOrderBody; status: Elysia["handle"] extends never ? never : any }) => {
      const lensResponse = await fetch(
        `${CATALOG_SERVICE_URL}/api/lenses/${body.lensId}`,
      );
      if (!lensResponse.ok) {
        return status(404, { error: "Lens not found" });
      }
      const lens = (await lensResponse.json()) as CatalogLens;

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) {
        return status(400, { error: "End date must be after start date" });
      }
      const totalPrice = (days * parseFloat(lens.dayPrice)).toFixed(2);

      const [order] = await db
        .insert(orders)
        .values({
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          lensId: body.lensId,
          lensSnapshot: {
            modelName: lens.modelName,
            manufacturerName: lens.manufacturerName,
            dayPrice: lens.dayPrice,
          },
          startDate: start,
          endDate: end,
          totalPrice,
        })
        .returning();
      if (!order) {
        return status(500, { error: "Failed to create order" });
      }

      await publishEvent("order.placed", {
        orderId: order.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        lensName: lens.modelName,
      });

      return status(201, serializeOrder(order));
    },
    {
      body: createOrderBodySchema,
      detail: {
        summary: "Create a rental order",
        description:
          "Creates a new rental order after validating the selected lens and rental period.",
        tags: ["Orders"],
      },
      response: {
        201: orderSchema,
        400: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
    },
  )
  .get(
    "/api/orders",
    async () => {
      const results = await db.select().from(orders);
      return results.map(serializeOrder);
    },
    {
      detail: {
        summary: "List all orders",
        description: "Returns all rental orders stored in the system.",
        tags: ["Orders"],
      },
      response: {
        200: t.Array(orderSchema),
      },
    },
  )
  .get(
    "/api/orders/:id",
    async ({ params, status }: { params: OrderParams; status: Elysia["handle"] extends never ? never : any }) => {
      const results = await db
        .select()
        .from(orders)
        .where(eq(orders.id, params.id));
      if (!results[0]) {
        return status(404, { error: "Order not found" });
      }
      return serializeOrder(results[0]);
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Get order by ID",
        description: "Returns a single rental order by its unique identifier.",
        tags: ["Orders"],
      },
      response: {
        200: orderSchema,
        404: errorSchema,
      },
    },
  )
  .get("/health", () => ({ status: "ok", service: "order-service" }), {
    detail: {
      summary: "Service health check",
      description: "Returns the health status of the order service.",
      tags: ["Health"],
    },
    response: {
      200: healthSchema,
    },
  })
  .listen(3002);

console.log(`Order Service running on port ${app.server?.port}`);
