import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (
  buffer: Buffer
) => Promise<{ text: string }>;
const prisma = new PrismaClient();

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
  documentId?: string;
};

type ExtractedMedicalData = {
  documentId: string;
  filename: string;
  documentType: string;
  confidence: number;
  actionTitle: string;
  actionDescription: string;
  actionSource: string;
  hasMedication: boolean;
  medicationName: string;
  medicationDosage: string;
  medicationInstructions: string;
  medicationSource: string;
  hasObservation: boolean;
  observationTitle: string;
  observationDescription: string;
  observationSource: string;
  extractedTextPreview: string;
};


const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

server.get("/health", async () => {
  return {
    ok: true,
    service: "continuum-api",
  };
});

server.post("/documents/extract", async (request, reply) => {
  const uploadedFile = await request.file();

  if (!uploadedFile) {
    return reply.code(400).send({
      error: "No file uploaded",
    });
  }

  const fileBuffer = await uploadedFile.toBuffer();
  const filename = uploadedFile.filename || "document-importe.pdf";

  let extractedText = "";

  if (uploadedFile.mimetype === "application/pdf") {
    const parsedPdf = await pdfParse(fileBuffer);
    extractedText = parsedPdf.text || "";
  }

  const extraction = extractMedicalDataFromText({
    filename,
    extractedText,
  });

  const documentId = crypto.randomUUID();

  const document = await prisma.document.create({
    data: {
      id: documentId,
      filename,
      mimeType: uploadedFile.mimetype,
      sizeBytes: fileBuffer.byteLength,
      documentType: extraction.documentType,
      confidence: extraction.confidence,
      extractedText,
      actionTitle: extraction.actionTitle,
      actionDescription: extraction.actionDescription,
      observationTitle: extraction.observationTitle || "",
      observationDescription: extraction.observationDescription || "",
      medicationName: extraction.medicationName || "",
      medicationDosage: extraction.medicationDosage || "",
      source: extraction.actionSource || filename,
    },
  });

  return reply.send({
    ...extraction,
    documentId: document.id,
    filename: document.filename,
  });
});

server.get("/shares", async () => {
  const shares = await prisma.sharedBrief.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      accessLogs: true,
    },
  });

  return shares.map((share) => {
    const now = Date.now();
    const isRevoked = Boolean(share.revokedAt);
    const isExpired = share.expiresAt.getTime() < now;

    return {
      id: share.id,
      code: share.code,
      documentType: share.documentType,
      actionTitle: share.actionTitle,
      source: share.source,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      accessCount: share.accessLogs.length,
      latestAccessAt: share.accessLogs[0]?.openedAt ?? null,
      status: isRevoked ? "revoked" : isExpired ? "expired" : "active",
    };
  });
});

server.post("/shares", async (request, reply) => {
  const body = request.body as Partial<SharedBrief>;

  const id = crypto.randomUUID();
  const code = "739421";

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const sharedBrief = await prisma.sharedBrief.create({
    data: {
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
      expiresAt,
	  documentId: body.documentId || undefined,
    },
  });

  return reply.code(201).send({
    shareId: sharedBrief.id,
    code: sharedBrief.code,
    url: `http://localhost:3000?shareId=${sharedBrief.id}`,
  });
});


server.get("/shares/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  const sharedBrief = await prisma.sharedBrief.findUnique({
    where: { id },
  });

  if (!sharedBrief) {
    return reply.code(404).send({
      error: "Share not found",
    });
  }
	if (sharedBrief.revokedAt) {
  		return reply.code(403).send({
    		error: "Share revoked",
 	 	});
	}


  if (sharedBrief.expiresAt.getTime() < Date.now()) {
    return reply.code(410).send({
      error: "Share expired",
    });
  }

  await prisma.accessLog.create({
    data: {
      id: crypto.randomUUID(),
      shareId: sharedBrief.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] || "",
    },
  });

  return {
    ...sharedBrief,
    observationTitle: sharedBrief.observationTitle || "",
    observationDescription: sharedBrief.observationDescription || "",
    medicationName: sharedBrief.medicationName || "",
    medicationDosage: sharedBrief.medicationDosage || "",
  };
});

server.patch("/shares/:id/revoke", async (request, reply) => {
  const { id } = request.params as { id: string };

  const existingShare = await prisma.sharedBrief.findUnique({
    where: { id },
  });

  if (!existingShare) {
    return reply.code(404).send({
      error: "Share not found",
    });
  }

  if (existingShare.revokedAt) {
    return {
      shareId: existingShare.id,
      revokedAt: existingShare.revokedAt,
      alreadyRevoked: true,
    };
  }

  const revokedShare = await prisma.sharedBrief.update({
    where: { id },
    data: {
      revokedAt: new Date(),
    },
  });

  return {
    shareId: revokedShare.id,
    revokedAt: revokedShare.revokedAt,
    alreadyRevoked: false,
  };
});

server.get("/shares/:id/access-logs", async (request, reply) => {
  const { id } = request.params as { id: string };

  const sharedBrief = await prisma.sharedBrief.findUnique({
    where: { id },
  });

  if (!sharedBrief) {
    return reply.code(404).send({
      error: "Share not found",
    });
  }

  const logs = await prisma.accessLog.findMany({
    where: {
      shareId: id,
    },
    orderBy: {
      openedAt: "desc",
    },
  });

  return {
    shareId: id,
    count: logs.length,
    logs,
  };
});

function extractMedicalDataFromText({
  filename,
  extractedText,
}: {
  filename: string;
  extractedText: string;
}): ExtractedMedicalData {
  const normalizedFilename = filename.toLowerCase();
  const normalizedText = extractedText.toLowerCase();

  const source = detectSource(filename, extractedText);

  const looksLikeBiology =
    normalizedFilename.includes("analyse") ||
    normalizedFilename.includes("biologie") ||
    normalizedFilename.includes("biologique") ||
    normalizedFilename.includes("bilan") ||
    normalizedText.includes("créatinine") ||
    normalizedText.includes("creatinine") ||
    normalizedText.includes("potassium") ||
    normalizedText.includes("glycémie") ||
    normalizedText.includes("glycemie") ||
    normalizedText.includes("dfg");

  if (looksLikeBiology) {
    const hasHighGlucose =
      normalizedText.includes("glycémie") ||
      normalizedText.includes("glycemie");

    return {
      documentType: "Analyse biologique",
      confidence: extractedText.length > 0 ? 0.94 : 0.78,
      actionTitle: "Discuter le bilan rénal + potassium avec le médecin",
      actionDescription:
        "Analyse détectée comme bilan de suivi. Les résultats doivent être interprétés par un professionnel de santé.",
      actionSource: source,
      hasMedication: false,
      medicationName: "",
      medicationDosage: "",
      medicationInstructions: "",
      medicationSource: "",
      hasObservation: hasHighGlucose,
      observationTitle: hasHighGlucose ? "Glycémie à jeun limite haute" : "",
      observationDescription: hasHighGlucose
        ? "Point de vigilance détecté dans le compte rendu. À recontrôler ou contextualiser avec le médecin. Ceci n’est pas un diagnostic."
        : "",
      observationSource: hasHighGlucose ? source : "",
      extractedTextPreview: extractedText.slice(0, 900),
    };
  }

  const looksLikePrescription =
    normalizedFilename.includes("ordonnance") ||
    normalizedText.includes("ordonnance") ||
    normalizedText.includes("prescription") ||
    normalizedText.includes("ramipril") ||
    normalizedText.includes("radiographie");

  if (looksLikePrescription) {
    return {
      documentType: "Ordonnance",
      confidence: extractedText.length > 0 ? 0.91 : 0.74,
      actionTitle: "Radiographie du genou droit",
      actionDescription: "Examen détecté depuis une ordonnance importée.",
      actionSource: source,
      hasMedication: true,
      medicationName: normalizedText.includes("ramipril") ? "Ramipril" : "",
      medicationDosage: normalizedText.includes("2,5") ? "2,5 mg" : "",
      medicationInstructions: "Posologie à confirmer avec le médecin.",
      medicationSource: source,
      hasObservation: false,
      observationTitle: "",
      observationDescription: "",
      observationSource: "",
      extractedTextPreview: extractedText.slice(0, 900),
    };
  }

  return {
    documentType: "Document médical",
    confidence: extractedText.length > 0 ? 0.65 : 0.35,
    actionTitle: "Document médical à vérifier",
    actionDescription:
      "Le document a été importé, mais l’extraction automatique reste incertaine. Vérifiez les informations avant de les ajouter au carnet.",
    actionSource: source,
    hasMedication: false,
    medicationName: "",
    medicationDosage: "",
    medicationInstructions: "",
    medicationSource: "",
    hasObservation: false,
    observationTitle: "",
    observationDescription: "",
    observationSource: "",
    extractedTextPreview: extractedText.slice(0, 900),
  };
}

function detectSource(filename: string, extractedText: string): string {
  const dateMatch = extractedText.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const detectedDate = dateMatch?.[0];

  if (detectedDate) {
    return `${filename} — ${detectedDate}`;
  }

  return filename;
}

await server.listen({
  port: 4000,
  host: "0.0.0.0",
});