import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const prisma = new PrismaClient();

const API_PORT = 4000;
const SHARE_CODE = "739421";
const SHARE_DURATION_HOURS = 24;
const DEFAULT_FOLLOW_UP_DAYS = 10;

const server = Fastify({
  logger: true,
});

type SharedBriefRequest = {
  id?: string;
  code?: string;
  documentId?: string;
  documentType?: string;
  actionTitle?: string;
  actionDescription?: string;
  observationTitle?: string;
  observationDescription?: string;
  medicationName?: string;
  medicationDosage?: string;
  source?: string;
  createdAt?: string;
  expiresAt?: string;
};

type ExtractedMedicalData = {
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

type MedicationRule = {
  aliases: string[];
  name: string;
  defaultDosage?: string;
  defaultInstructions: string;
  defaultDurationDays: number | null;
  isLongTerm: boolean;
  renewalAfterDays: number | null;
  nextDoseAfterDays: number | null;
};

const medicationRules: MedicationRule[] = [
  {
    aliases: ["ramipril"],
    name: "Ramipril",
    defaultDosage: "2,5 mg",
    defaultInstructions: "1 comprimé le matin, à heure fixe.",
    defaultDurationDays: null,
    isLongTerm: true,
    renewalAfterDays: 30,
    nextDoseAfterDays: 1,
  },
  {
    aliases: ["doliprane", "paracetamol", "paracétamol"],
    name: "Doliprane",
    defaultInstructions: "Posologie à confirmer avec le médecin ou le pharmacien.",
    defaultDurationDays: 5,
    isLongTerm: false,
    renewalAfterDays: null,
    nextDoseAfterDays: null,
  },
  {
    aliases: ["amoxicilline", "amoxicillin"],
    name: "Amoxicilline",
    defaultInstructions: "Posologie et durée à confirmer avec le médecin.",
    defaultDurationDays: 7,
    isLongTerm: false,
    renewalAfterDays: null,
    nextDoseAfterDays: null,
  },
  {
    aliases: ["levothyrox", "levothyroxine", "lévothyroxine"],
    name: "Levothyrox",
    defaultInstructions: "Traitement longue durée. Posologie à confirmer avec le médecin.",
    defaultDurationDays: null,
    isLongTerm: true,
    renewalAfterDays: 30,
    nextDoseAfterDays: 1,
  },
  {
    aliases: ["atorvastatine", "atorvastatin"],
    name: "Atorvastatine",
    defaultInstructions: "Traitement longue durée. Posologie à confirmer avec le médecin.",
    defaultDurationDays: null,
    isLongTerm: true,
    renewalAfterDays: 30,
    nextDoseAfterDays: 1,
  },
  {
    aliases: ["metformine", "metformin"],
    name: "Metformine",
    defaultInstructions: "Traitement longue durée. Posologie à confirmer avec le médecin.",
    defaultDurationDays: null,
    isLongTerm: true,
    renewalAfterDays: 30,
    nextDoseAfterDays: 1,
  },
];

await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  if (typeof pdfParseModule === "function") {
    const result = await pdfParseModule(buffer);
    return result.text || "";
  }

  if (typeof pdfParseModule.default === "function") {
    const result = await pdfParseModule.default(buffer);
    return result.text || "";
  }

  if (pdfParseModule.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const result = await parser.getText();

    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }

    return result.text || "";
  }

  throw new Error("Unsupported pdf-parse export format");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysUntil(date: Date | null): number | null {
  if (!date) {
    return null;
  }

  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function detectSource(filename: string, extractedText: string): string {
  const dateMatch = extractedText.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const detectedDate = dateMatch?.[0];

  if (detectedDate) {
    return `${filename} — ${detectedDate}`;
  }

  return filename;
}

function detectMedicationRule(normalizedText: string): MedicationRule | null {
  return (
    medicationRules.find((rule) =>
      rule.aliases.some((alias) => normalizedText.includes(normalizeText(alias)))
    ) ?? null
  );
}

function detectMedicationDosage(
  normalizedText: string,
  rule: MedicationRule
): string {
  if (rule.name === "Ramipril") {
    if (normalizedText.includes("2,5") || normalizedText.includes("2.5")) {
      return "2,5 mg";
    }
  }

  const dosageMatch = normalizedText.match(/\b\d+(?:[,.]\d+)?\s?(?:mg|g|ml)\b/);

  if (dosageMatch) {
    return dosageMatch[0].replace(".", ",");
  }

  return rule.defaultDosage ?? "";
}

function extractMedicalDataFromText({
  filename,
  extractedText,
}: {
  filename: string;
  extractedText: string;
}): ExtractedMedicalData {
  const normalizedFilename = normalizeText(filename);
  const normalizedText = normalizeText(extractedText);
  const source = detectSource(filename, extractedText);
  const medicationRule = detectMedicationRule(normalizedText);

  const looksLikePrescription =
    Boolean(medicationRule) ||
    normalizedFilename.includes("ordonnance") ||
    normalizedText.includes("ordonnance") ||
    normalizedText.includes("prescription") ||
    normalizedText.includes("traitement prescrit");

  if (looksLikePrescription) {
    return buildPrescriptionExtraction({
      extractedText,
      normalizedText,
      source,
      medicationRule,
    });
  }

  const looksLikeBiology =
    normalizedFilename.includes("analyse") ||
    normalizedFilename.includes("biologie") ||
    normalizedFilename.includes("biologique") ||
    normalizedFilename.includes("bilan") ||
    normalizedText.includes("creatinine") ||
    normalizedText.includes("potassium") ||
    normalizedText.includes("glycemie") ||
    normalizedText.includes("dfg");

  if (looksLikeBiology) {
    return buildBiologyExtraction({
      extractedText,
      normalizedText,
      source,
    });
  }

  return buildFallbackExtraction({
    extractedText,
    source,
  });
}

function buildPrescriptionExtraction({
  extractedText,
  normalizedText,
  source,
  medicationRule,
}: {
  extractedText: string;
  normalizedText: string;
  source: string;
  medicationRule: MedicationRule | null;
}): ExtractedMedicalData {
  const hasMedication = Boolean(medicationRule);
  const medicationName = medicationRule?.name ?? "";
  const medicationDosage = medicationRule
    ? detectMedicationDosage(normalizedText, medicationRule)
    : "";
  const medicationInstructions = medicationRule?.defaultInstructions ?? "";

  const asksForRenalMonitoring =
    normalizedText.includes("bilan renal") ||
    normalizedText.includes("potassium") ||
    normalizedText.includes("creatinine");

  const actionTitle = hasMedication
    ? `Suivre le traitement ${medicationName}`
    : "Ordonnance à vérifier";

  const actionDescription = hasMedication
    ? "Ordonnance détectée avec un traitement. Les modalités doivent être confirmées avec un professionnel de santé."
    : "Ordonnance détectée. Vérifiez les informations extraites avant de les ajouter au carnet.";

  return {
    documentType: "Ordonnance",
    confidence: extractedText.length > 0 ? 0.92 : 0.74,
    actionTitle,
    actionDescription,
    actionSource: source,
    hasMedication,
    medicationName,
    medicationDosage,
    medicationInstructions,
    medicationSource: hasMedication ? source : "",
    hasObservation: asksForRenalMonitoring,
    observationTitle: asksForRenalMonitoring
      ? "Surveillance bilan rénal + potassium"
      : "",
    observationDescription: asksForRenalMonitoring
      ? "Surveillance demandée après introduction du traitement. À confirmer avec le médecin."
      : "",
    observationSource: asksForRenalMonitoring ? source : "",
    extractedTextPreview: extractedText.slice(0, 900),
  };
}

function buildBiologyExtraction({
  extractedText,
  normalizedText,
  source,
}: {
  extractedText: string;
  normalizedText: string;
  source: string;
}): ExtractedMedicalData {
  const hasHighGlucose = normalizedText.includes("glycemie");

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

function buildFallbackExtraction({
  extractedText,
  source,
}: {
  extractedText: string;
  source: string;
}): ExtractedMedicalData {
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

async function createReminderFromExtraction({
  documentId,
  extraction,
  now,
}: {
  documentId: string;
  extraction: ExtractedMedicalData;
  now: Date;
}) {
  if (!extraction.actionTitle || extraction.documentType === "Document médical") {
    return;
  }

  await prisma.reminder.create({
    data: {
      id: crypto.randomUUID(),
      documentId,
      title: extraction.actionTitle,
      description: extraction.actionDescription,
      dueDate: addDays(now, DEFAULT_FOLLOW_UP_DAYS),
      type: "follow_up",
      status: "pending",
    },
  });
}

async function createTreatmentFromExtraction({
  documentId,
  extraction,
  now,
}: {
  documentId: string;
  extraction: ExtractedMedicalData;
  now: Date;
}) {
  if (!extraction.hasMedication || extraction.medicationName.trim().length === 0) {
    return;
  }

  const medicationName = extraction.medicationName.trim();
  const normalizedMedicationName = normalizeText(medicationName);
  const medicationRule = detectMedicationRule(normalizedMedicationName);

  const isLongTerm = medicationRule?.isLongTerm ?? false;
  const durationDays = medicationRule?.defaultDurationDays ?? 15;
  const renewalAfterDays = medicationRule?.renewalAfterDays;
  const nextDoseAfterDays = medicationRule?.nextDoseAfterDays;

  const startDate = now;
  const endDate = isLongTerm ? null : addDays(startDate, durationDays);
  const renewalDate = renewalAfterDays
    ? addDays(startDate, renewalAfterDays)
    : endDate;
  const nextDoseDate = nextDoseAfterDays
    ? addDays(startDate, nextDoseAfterDays)
    : null;

  await prisma.treatment.create({
    data: {
      id: crypto.randomUUID(),
      documentId,
      name: medicationName,
      dosage: extraction.medicationDosage || "",
      instructions: extraction.medicationInstructions || "",
      startDate,
      endDate,
      durationDays: isLongTerm ? null : durationDays,
      isLongTerm,
      renewalDate,
      nextDoseDate,
      status: "active",
    },
  });

  if (!renewalDate) {
    return;
  }

  await prisma.reminder.create({
    data: {
      id: crypto.randomUUID(),
      documentId,
      title: `Renouvellement ${medicationName}`,
      description: isLongTerm
        ? "Renouvellement à anticiper pour un traitement longue durée."
        : "Fin de traitement ou renouvellement à vérifier.",
      dueDate: renewalDate,
      type: "renewal",
      status: "pending",
    },
  });
}

server.get("/health", async () => {
  return {
    ok: true,
    service: "continuum-api",
  };
});

server.get("/dashboard", async () => {
  const now = Date.now();

  const [documents, shares, treatments, reminders] = await Promise.all([
    prisma.document.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        shares: true,
      },
    }),

    prisma.sharedBrief.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        accessLogs: {
          orderBy: {
            openedAt: "desc",
          },
        },
      },
    }),

    prisma.treatment.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.reminder.findMany({
      where: {
        status: "pending",
      },
      orderBy: {
        dueDate: "asc",
      },
    }),
  ]);

  const activeShares = shares.filter(
    (share) => !share.revokedAt && share.expiresAt.getTime() > now
  );

  const recentDocuments = uniqueBy(
    documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      documentType: document.documentType,
      confidence: document.confidence,
      createdAt: document.createdAt,
      source: document.source,
      shareCount: document.shares.length,
    })),
    (document) => `${document.filename}-${document.documentType}-${document.source}`
  ).slice(0, 3);

  const latestActions = uniqueBy(
    documents
      .filter((document) => document.actionTitle)
      .map((document) => ({
        id: document.id,
        title: document.actionTitle,
        description: document.actionDescription,
        source: document.source,
        documentType: document.documentType,
        createdAt: document.createdAt,
      })),
    (action) => `${action.title}-${action.description}`
  ).slice(0, 5);

  const vigilancePoints = uniqueBy(
    documents
      .filter((document) => document.observationTitle)
      .map((document) => ({
        id: document.id,
        title: document.observationTitle,
        description: document.observationDescription,
        source: document.source,
        documentType: document.documentType,
        createdAt: document.createdAt,
      })),
    (point) => `${point.title}-${point.description}`
  ).slice(0, 5);

  const activeShareSummaries = activeShares.slice(0, 5).map((share) => ({
    id: share.id,
    documentId: share.documentId,
    documentType: share.documentType,
    actionTitle: share.actionTitle,
    source: share.source,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    accessCount: share.accessLogs.length,
    latestAccessAt: share.accessLogs[0]?.openedAt ?? null,
  }));

  const activeTreatments = treatments
    .filter((treatment) => {
      if (treatment.isLongTerm) {
        return true;
      }

      if (!treatment.endDate) {
        return true;
      }

      return treatment.endDate.getTime() >= now;
    })
    .slice(0, 5)
    .map((treatment) => ({
      id: treatment.id,
      documentId: treatment.documentId,
      name: treatment.name,
      dosage: treatment.dosage,
      instructions: treatment.instructions,
      startDate: treatment.startDate,
      endDate: treatment.endDate,
      durationDays: treatment.durationDays,
      isLongTerm: treatment.isLongTerm,
      renewalDate: treatment.renewalDate,
      nextDoseDate: treatment.nextDoseDate,
      daysRemaining: daysUntil(treatment.endDate),
      daysBeforeRenewal: daysUntil(treatment.renewalDate),
      daysBeforeNextDose: daysUntil(treatment.nextDoseDate),
    }));

  const upcomingReminders = reminders.slice(0, 5).map((reminder) => ({
    id: reminder.id,
    documentId: reminder.documentId,
    title: reminder.title,
    description: reminder.description,
    dueDate: reminder.dueDate,
    type: reminder.type,
    daysUntilDue: daysUntil(reminder.dueDate),
  }));

  return {
    stats: {
      documentCount: documents.length,
      activeShareCount: activeShares.length,
      actionCount: latestActions.length,
      vigilanceCount: vigilancePoints.length,
      treatmentCount: activeTreatments.length,
      reminderCount: upcomingReminders.length,
    },
    recentDocuments,
    latestActions,
    vigilancePoints,
    activeShares: activeShareSummaries,
    activeTreatments,
    upcomingReminders,
  };
});

server.get("/documents", async () => {
  const documents = await prisma.document.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      shares: true,
    },
  });

  return documents.map((document) => {
    const now = Date.now();

    const activeShares = document.shares.filter(
      (share) => !share.revokedAt && share.expiresAt.getTime() > now
    );

    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      documentType: document.documentType,
      confidence: document.confidence,
      actionTitle: document.actionTitle,
      actionDescription: document.actionDescription,
      observationTitle: document.observationTitle,
      observationDescription: document.observationDescription,
      medicationName: document.medicationName,
      medicationDosage: document.medicationDosage,
      source: document.source,
      createdAt: document.createdAt,
      shareCount: document.shares.length,
      activeShareCount: activeShares.length,
    };
  });
});

server.delete("/documents/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    return reply.code(404).send({
      error: "Document not found",
    });
  }

  await prisma.reminder.deleteMany({
    where: {
      documentId: id,
    },
  });

  await prisma.treatment.deleteMany({
    where: {
      documentId: id,
    },
  });

  await prisma.sharedBrief.updateMany({
    where: {
      documentId: id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await prisma.sharedBrief.updateMany({
    where: {
      documentId: id,
    },
    data: {
      documentId: null,
    },
  });

  await prisma.document.delete({
    where: { id },
  });

  return {
    deleted: true,
    documentId: id,
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
    extractedText = await extractPdfText(fileBuffer);
  }

  const extraction = extractMedicalDataFromText({
    filename,
    extractedText,
  });

  const document = await prisma.document.create({
    data: {
      id: crypto.randomUUID(),
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

  const now = new Date();

  await createReminderFromExtraction({
    documentId: document.id,
    extraction,
    now,
  });

  await createTreatmentFromExtraction({
    documentId: document.id,
    extraction,
    now,
  });

  return reply.send({
    ...extraction,
    documentId: document.id,
    filename: document.filename,
  });
});

server.get("/treatments", async () => {
  const treatments = await prisma.treatment.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return treatments.map((treatment) => ({
    id: treatment.id,
    documentId: treatment.documentId,
    name: treatment.name,
    dosage: treatment.dosage,
    instructions: treatment.instructions,
    startDate: treatment.startDate,
    endDate: treatment.endDate,
    durationDays: treatment.durationDays,
    isLongTerm: treatment.isLongTerm,
    renewalDate: treatment.renewalDate,
    nextDoseDate: treatment.nextDoseDate,
    status: treatment.status,
    createdAt: treatment.createdAt,
    daysRemaining: daysUntil(treatment.endDate),
    daysBeforeRenewal: daysUntil(treatment.renewalDate),
    daysBeforeNextDose: daysUntil(treatment.nextDoseDate),
  }));
});

server.get("/reminders", async () => {
  const reminders = await prisma.reminder.findMany({
    orderBy: {
      dueDate: "asc",
    },
  });

  return reminders.map((reminder) => ({
    id: reminder.id,
    documentId: reminder.documentId,
    title: reminder.title,
    description: reminder.description,
    dueDate: reminder.dueDate,
    type: reminder.type,
    status: reminder.status,
    createdAt: reminder.createdAt,
    daysUntilDue: daysUntil(reminder.dueDate),
  }));
});

server.get("/shares", async () => {
  const shares = await prisma.sharedBrief.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      accessLogs: {
        orderBy: {
          openedAt: "desc",
        },
      },
    },
  });

  return shares.map((share) => {
    const now = Date.now();
    const isRevoked = Boolean(share.revokedAt);
    const isExpired = share.expiresAt.getTime() < now;

    return {
      id: share.id,
      code: share.code,
      documentId: share.documentId,
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
  const body = request.body as Partial<SharedBriefRequest>;

  const id = crypto.randomUUID();
  const code = SHARE_CODE;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SHARE_DURATION_HOURS * 60 * 60 * 1000
  );

  let validDocumentId: string | undefined;

  if (body.documentId) {
    const document = await prisma.document.findUnique({
      where: {
        id: body.documentId,
      },
    });

    validDocumentId = document?.id;
  }

  const sharedBrief = await prisma.sharedBrief.create({
    data: {
      id,
      code,
      documentId: validDocumentId,
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

await server.listen({
  port: API_PORT,
  host: "0.0.0.0",
});
