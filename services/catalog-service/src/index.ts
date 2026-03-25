import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { lenses } from "./db/schema";
import { eq } from "drizzle-orm";

const lensSchema = t.Object({
  id: t.String({ format: "uuid" }),
  modelName: t.String(),
  manufacturerName: t.String(),
  minFocalLength: t.Number(),
  maxFocalLength: t.Number(),
  maxAperture: t.String(),
  mountType: t.String(),
  dayPrice: t.String(),
  weekendPrice: t.String(),
  description: t.Nullable(t.String()),
});

const errorSchema = t.Object({
  error: t.String(),
});

const healthSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Suilens Catalog Service API",
          version: "1.0.0",
          description: "Catalog API for retrieving available camera lenses.",
        },
        tags: [
          { name: "Lenses", description: "Lens catalog endpoints" },
          { name: "Health", description: "Service health check endpoint" },
        ],
      },
      path: "/docs",
    }),
  )
  .get("/api/lenses", async () => db.select().from(lenses), {
    detail: {
      summary: "List all lenses",
      description: "Returns all lenses available in the rental catalog.",
      tags: ["Lenses"],
    },
    response: {
      200: t.Array(lensSchema),
    },
  })
  .get(
    "/api/lenses/:id",
    async ({ params, status }: { params: { id: string }; status: Elysia["handle"] extends never ? never : any }) => {
      const results = await db
        .select()
        .from(lenses)
        .where(eq(lenses.id, params.id));
      if (!results[0]) {
        return status(404, { error: "Lens not found" });
      }
      return results[0];
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Get lens by ID",
        description: "Returns a single lens from the rental catalog by its ID.",
        tags: ["Lenses"],
      },
      response: {
        200: lensSchema,
        404: errorSchema,
      },
    },
  )
  .get("/health", () => ({ status: "ok", service: "catalog-service" }), {
    detail: {
      summary: "Service health check",
      description: "Returns the health status of the catalog service.",
      tags: ["Health"],
    },
    response: {
      200: healthSchema,
    },
  })
  .listen(3001);

console.log(`Catalog Service running on port ${app.server?.port}`);
