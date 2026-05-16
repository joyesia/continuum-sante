import Fastify from "fastify";
import cors from "@fastify/cors";
import crypto from "node:crypto";

type SharedBrief = {
  id: string;
  code: string;
  documentType: string;
  actionTitle: string;
  actionDescription: string;
  observationTitle?: string;
  observationDescription?: string;
  medicationName?: string;
  medicationDosage?: string;
  source: string;
  createdAt: string;
  expiresAt: string;
};

const shares = new Map<string, SharedBrief>();

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});

server.get("/health", async () => {
  return {
    ok: true,
    service: "continuum-api",
  };
});

server.post("/shares", async (request, reply) => {
  const body = request.body as Partial<SharedBrief>;

  const id = crypto.randomUUID();
  const code = "739421";

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const sharedBrief: SharedBrief = {
    id,
    code,
    documentType: body.documentType || "Document médical",
    actionTitle: body.actionTitle || "Action médicale à vérifier",
    actionDescription:
      body.actionDescription ||
      "Élément extrait depuis un document importé par le patient.",
    observationTitle: body.observationTitle || "",
    observationDescription: body.observationDescription || "",
    medicationName: body.medicationName || "",
    medicationDosage: body.medicationDosage || "",
    source: body.source || "Document importé",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  shares.set(id, sharedBrief);

  return reply.code(201).send({
    shareId: id,
    code,
    url: `http://localhost:3000?shareId=${id}`,
  });
});

server.get("/shares/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const sharedBrief = shares.get(id);

  if (!sharedBrief) {
    return reply.code(404).send({
      error: "Share not found",
    });
  }

  return sharedBrief;
});

await server.listen({
  port: 4000,
  host: "0.0.0.0",
});