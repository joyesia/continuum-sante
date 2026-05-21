import { useEffect, useState, type ReactNode } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

type Screen =
  | "dashboard"
  | "analyzing"
  | "review"
  | "share"
  | "shares"
  | "documents";

type EditingSection = null | "document" | "action" | "medication" | "observation";

type ImportedDocument = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

type MedicalAction = {
  id: string;
  title: string;
  description: string;
  source: string;
};

type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  source: string;
};

type Observation = {
  id: string;
  title: string;
  description: string;
  source: string;
};

type ApiExtraction = {
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
  documentId: string;
  filename: string;
};

type PatientShare = {
  id: string;
  code: string;
  documentType: string;
  actionTitle: string;
  source: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  accessCount: number;
  latestAccessAt?: string | null;
  status: "active" | "revoked" | "expired";
};

type PatientDocument = {
  id: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  documentType: string;
  confidence: number;
  actionTitle: string;
  actionDescription: string;
  observationTitle?: string | null;
  observationDescription?: string | null;
  medicationName?: string | null;
  medicationDosage?: string | null;
  source: string;
  createdAt: string;
  shareCount: number;
  activeShareCount: number;
};

type DashboardDocument = {
  id: string;
  filename: string;
  documentType: string;
  confidence: number;
  createdAt: string;
  source: string;
  shareCount: number;
};

type DashboardAction = {
  id: string;
  title: string;
  description: string;
  source: string;
  documentType: string;
  createdAt: string;
};

type DashboardVigilancePoint = {
  id: string;
  title: string;
  description: string;
  source: string;
  documentType: string;
  createdAt: string;
};

type DashboardTreatment = {
  id: string;
  documentId?: string | null;
  name: string;
  dosage?: string | null;
  instructions?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  isLongTerm: boolean;
  renewalDate?: string | null;
  nextDoseDate?: string | null;
  daysRemaining?: number | null;
  daysBeforeRenewal?: number | null;
  daysBeforeNextDose?: number | null;
};

type DashboardReminder = {
  id: string;
  documentId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  type: string;
  daysUntilDue?: number | null;
};

type DashboardActiveShare = {
  id: string;
  documentId?: string | null;
  documentType: string;
  actionTitle: string;
  source: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  latestAccessAt?: string | null;
};

type PatientDashboard = {
  stats: DashboardStats;
  recentDocuments: DashboardDocument[];
  latestActions: DashboardAction[];
  vigilancePoints: DashboardVigilancePoint[];
  activeShares: DashboardActiveShare[];
  activeTreatments: DashboardTreatment[];
  upcomingReminders: DashboardReminder[];
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [importedDocument, setImportedDocument] = useState<ImportedDocument | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [accessCount, setAccessCount] = useState<number | null>(null);
  const [latestAccessAt, setLatestAccessAt] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [revokedAt, setRevokedAt] = useState<string | null>(null);
  const [isRevokingShare, setIsRevokingShare] = useState(false);

  const [shares, setShares] = useState<PatientShare[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);


  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  const [actions, setActions] = useState<MedicalAction[]>([
    {
      id: "prise-de-sang",
      title: "Prise de sang à prévoir",
      description: "Bilan rénal + potassium.",
      source: "Compte rendu — 12/03/2026",
    },
  ]);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);

  const [documentType, setDocumentType] = useState("Ordonnance");
  const [documentConfidence, setDocumentConfidence] = useState(0.92);

  const [actionTitle, setActionTitle] = useState("Radiographie du genou droit");
  const [actionDescription, setActionDescription] = useState(
    "Examen détecté depuis une ordonnance importée."
  );
  const [actionSource, setActionSource] = useState("Ordonnance — 15/05/2026");

  const [hasMedication, setHasMedication] = useState(true);
  const [medicationName, setMedicationName] = useState("Ramipril");
  const [medicationDosage, setMedicationDosage] = useState("2,5 mg");
  const [medicationInstructions, setMedicationInstructions] = useState(
    "1 comprimé le matin — à confirmer avec le médecin."
  );
  const [medicationSource, setMedicationSource] = useState("Ordonnance — 19/03/2026");

  const [hasObservation, setHasObservation] = useState(false);
  const [observationTitle, setObservationTitle] = useState("");
  const [observationDescription, setObservationDescription] = useState("");
  const [observationSource, setObservationSource] = useState("");

  function showAlert(title: string, message: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
      return;
    }

    Alert.alert(title, message);
  }

  async function refreshDashboard() {
  try {
    setIsLoadingDashboard(true);

    const response = await fetch("http://localhost:4000/dashboard");

    if (!response.ok) {
      throw new Error("Impossible de récupérer le dashboard");
    }

    const data = (await response.json()) as PatientDashboard;

    setDashboard(data);
  } catch (error) {
    console.error(error);
  } finally {
    setIsLoadingDashboard(false);
  }
}

useEffect(() => {
  refreshDashboard();
}, []);

  function applyExtraction(extraction: ApiExtraction) {
	setCurrentDocumentId(extraction.documentId);

    setDocumentType(extraction.documentType);
    setDocumentConfidence(extraction.confidence);

    setActionTitle(extraction.actionTitle);
    setActionDescription(extraction.actionDescription);
    setActionSource(extraction.actionSource);

    setHasMedication(extraction.hasMedication);
    setMedicationName(extraction.medicationName);
    setMedicationDosage(extraction.medicationDosage);
    setMedicationInstructions(extraction.medicationInstructions);
    setMedicationSource(extraction.medicationSource);

    setHasObservation(extraction.hasObservation);
    setObservationTitle(extraction.observationTitle);
    setObservationDescription(extraction.observationDescription);
    setObservationSource(extraction.observationSource);

    setEditingSection(null);
  }

  function applyFallbackExtractionForFile(fileName: string) {
    const normalizedName = fileName.toLowerCase();

    const looksLikeBiology =
      normalizedName.includes("analyse") ||
      normalizedName.includes("biologie") ||
      normalizedName.includes("biologique") ||
      normalizedName.includes("bilan");

    setEditingSection(null);

    if (looksLikeBiology) {
      setDocumentType("Analyse biologique");
      setDocumentConfidence(0.78);

      setActionTitle("Discuter le bilan rénal + potassium avec le médecin");
      setActionDescription(
        "Analyse détectée comme bilan de suivi après introduction d’un traitement. Les résultats doivent être interprétés par un professionnel."
      );
      setActionSource("Analyse biologique — 15/05/2026");

      setHasMedication(false);
      setMedicationName("");
      setMedicationDosage("");
      setMedicationInstructions("");
      setMedicationSource("");

      setHasObservation(true);
      setObservationTitle("Glycémie à jeun limite haute");
      setObservationDescription(
        "Point de vigilance détecté dans le compte rendu. À recontrôler ou contextualiser avec le médecin. Ceci n’est pas un diagnostic."
      );
      setObservationSource("Analyse biologique — 15/05/2026");

      return;
    }

    setDocumentType("Ordonnance");
    setDocumentConfidence(0.74);

    setActionTitle("Radiographie du genou droit");
    setActionDescription("Examen détecté depuis une ordonnance importée.");
    setActionSource("Ordonnance — 15/05/2026");

    setHasMedication(true);
    setMedicationName("Ramipril");
    setMedicationDosage("2,5 mg");
    setMedicationInstructions("1 comprimé le matin — à confirmer avec le médecin.");
    setMedicationSource("Ordonnance — 19/03/2026");

    setHasObservation(false);
    setObservationTitle("");
    setObservationDescription("");
    setObservationSource("");
  }

  async function startDocumentImport() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const file = result.assets[0];

    setImportedDocument({
      name: file.name,
      uri: file.uri,
      mimeType: file.mimeType,
      size: file.size,
    });

    setScreen("analyzing");

    try {
      const fileResponse = await fetch(file.uri);
      const fileBlob = await fileResponse.blob();

      const formData = new FormData();
      formData.append("file", fileBlob, file.name);

      const response = await fetch("http://localhost:4000/documents/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Extraction API failed");
      }

      const extraction = (await response.json()) as ApiExtraction;

      applyExtraction(extraction);
      setScreen("review");
    } catch (error) {
      console.error(error);
      applyFallbackExtractionForFile(file.name);
      setScreen("review");
    }
  }

  function confirmExtraction() {
    if (actionTitle.trim().length > 0) {
      setActions((currentActions) => [
        {
          id: `action-${Date.now()}`,
          title: actionTitle,
          description: actionDescription,
          source: actionSource,
        },
        ...currentActions,
      ]);
    }

    if (hasMedication && medicationName.trim().length > 0) {
      setMedications((currentMedications) => [
        {
          id: `medication-${Date.now()}`,
          name: medicationName,
          dosage: medicationDosage,
          instructions: medicationInstructions,
          source: medicationSource,
        },
        ...currentMedications,
      ]);
    }

    if (hasObservation && observationTitle.trim().length > 0) {
      setObservations((currentObservations) => [
        {
          id: `observation-${Date.now()}`,
          title: observationTitle,
          description: observationDescription,
          source: observationSource,
        },
        ...currentObservations,
      ]);
    }

    setEditingSection(null);
	setScreen("dashboard");
	refreshDashboard();
  }

  async function openDoctorBrief() {
    let doctorWindow: Window | null = null;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      doctorWindow = window.open("", "_blank");
    }

    try {
      const sourceValue =
        observationSource || actionSource || medicationSource || "Document importé";

      const response = await fetch("http://localhost:4000/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
		  documentId: currentDocumentId,
          documentType,
          actionTitle,
          actionDescription,
          observationTitle,
          observationDescription,
          medicationName,
          medicationDosage,
          source: sourceValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Impossible de créer le partage");
      }

      const data = await response.json();

      setCurrentShareId(data.shareId);
      setAccessCount(null);
      setLatestAccessAt(null);
      setRevokedAt(null);

      const doctorUrl = `http://localhost:3000/?shareId=${data.shareId}`;

      if (Platform.OS === "web" && doctorWindow) {
        doctorWindow.location.href = doctorUrl;
        return;
      }

      Linking.openURL(doctorUrl);
    } catch (error) {
      console.error(error);

      if (doctorWindow) {
        doctorWindow.close();
      }

      showAlert(
        "Erreur",
        "Impossible de créer le partage. Vérifie que l’API tourne sur localhost:4000."
      );
    }
  }

  async function refreshAccessLogs() {
    if (!currentShareId) {
      showAlert(
        "Aucun partage",
        "Ouvre d’abord un brief médecin pour générer un lien de partage."
      );
      return;
    }

    try {
      setIsLoadingLogs(true);

      const response = await fetch(
        `http://localhost:4000/shares/${currentShareId}/access-logs`
      );

      if (!response.ok) {
        throw new Error("Impossible de récupérer les logs d’accès");
      }

      const data = await response.json();

      setAccessCount(data.count);
      setLatestAccessAt(data.logs[0]?.openedAt ?? null);
    } catch (error) {
      console.error(error);
      showAlert("Erreur", "Impossible de récupérer l’historique d’accès.");
    } finally {
      setIsLoadingLogs(false);
    }
  }

  async function revokeCurrentShare() {
    if (!currentShareId) {
      showAlert(
        "Aucun partage",
        "Ouvre d’abord un brief médecin pour générer un lien de partage."
      );
      return;
    }

    try {
      setIsRevokingShare(true);

      const response = await fetch(
        `http://localhost:4000/shares/${currentShareId}/revoke`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Révocation échouée ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      setRevokedAt(data.revokedAt ?? new Date().toISOString());
      showAlert("Accès révoqué", "Le lien médecin n’est plus disponible.");
    } catch (error) {
      console.error(error);
      showAlert(
        "Erreur",
        error instanceof Error ? error.message : "Impossible de révoquer le partage."
      );
    } finally {
      setIsRevokingShare(false);
    }
  }

  async function refreshShares() {
    try {
      setIsLoadingShares(true);

      const response = await fetch("http://localhost:4000/shares");

      if (!response.ok) {
        throw new Error("Impossible de récupérer les partages");
      }

      const data = (await response.json()) as PatientShare[];

      setShares(data);
    } catch (error) {
      console.error(error);
      showAlert("Erreur", "Impossible de récupérer les partages actifs.");
    } finally {
      setIsLoadingShares(false);
    }
  }

async function refreshDocuments() {
  try {
    setIsLoadingDocuments(true);

    const response = await fetch("http://localhost:4000/documents");

    const rawText = await response.text();

    console.log("GET /documents status:", response.status);
    console.log("GET /documents raw:", rawText);

    if (!response.ok) {
      throw new Error(`Erreur API documents: ${response.status} ${rawText}`);
    }

    const data = JSON.parse(rawText) as PatientDocument[];

    console.log("GET /documents parsed:", data);

    setDocuments(data);
  } catch (error) {
    console.error("refreshDocuments error:", error);
    showAlert("Erreur", "Impossible de récupérer les documents importés.");
  } finally {
    setIsLoadingDocuments(false);
  }
}

async function deleteDocumentById(documentId: string) {
  const confirmed =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.confirm(
          "Supprimer ce document ? Les rappels et traitements associés seront aussi supprimés. Les partages liés seront révoqués."
        )
      : true;

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:4000/documents/${documentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Suppression échouée ${response.status}: ${errorText}`);
    }

    setDocuments((currentDocuments: PatientDocument[]) =>
      currentDocuments.filter((document) => document.id !== documentId)
    );

    await refreshDocuments();
    await refreshDashboard();

    showAlert("Document supprimé", "Le document et ses données associées ont été supprimés.");
  } catch (error) {
    console.error(error);
    showAlert("Erreur", "Impossible de supprimer ce document.");
  }
}

  async function revokeShareById(shareId: string) {
    try {
      const response = await fetch(`http://localhost:4000/shares/${shareId}/revoke`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Impossible de révoquer ce partage");
      }

      if (shareId === currentShareId) {
        const data = await response.json();
        setRevokedAt(data.revokedAt ?? new Date().toISOString());
      }

      await refreshShares();
    } catch (error) {
      console.error(error);
      showAlert("Erreur", "Impossible de révoquer ce partage.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {screen === "dashboard" && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Continuum Santé</Text>
            <Text style={styles.title}>Votre carnet de santé intelligent</Text>
            <Text style={styles.subtitle}>
              Importez vos documents médicaux, transformez-les en actions, puis
              partagez une synthèse claire avec un professionnel.
            </Text>
          </View>

			          <View style={styles.card}>
            <Text style={styles.cardTitle}>Points à surveiller</Text>

            {!dashboard || dashboard.vigilancePoints.length === 0 ? (
              <Text style={styles.emptyText}>
                Aucun point de vigilance détecté pour le moment.
              </Text>
            ) : (
              dashboard.vigilancePoints
                .slice(0, 2)
                .map((point: DashboardVigilancePoint) => (
                  <View key={point.id} style={styles.actionItem}>
                    <Text style={styles.actionTitle}>{point.title}</Text>
                    <Text style={styles.actionDescription}>{point.description}</Text>
                    <Text style={styles.source}>Source : {point.source}</Text>
                  </View>
                ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rappels à venir</Text>

            {!dashboard || dashboard.upcomingReminders.length === 0 ? (
              <Text style={styles.emptyText}>Aucun rappel à venir.</Text>
            ) : (
              dashboard.upcomingReminders
                .slice(0, 3)
                .map((reminder: DashboardReminder) => (
                  <View key={reminder.id} style={styles.actionItem}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitleNoMargin}>{reminder.title}</Text>
                      <Text style={styles.reminderPill}>
                        {reminder.daysUntilDue === 0
                          ? "Aujourd’hui"
                          : reminder.daysUntilDue && reminder.daysUntilDue > 0
                          ? `J-${reminder.daysUntilDue}`
                          : "Échu"}
                      </Text>
                    </View>

                    {reminder.description && (
                      <Text style={styles.actionDescription}>
                        {reminder.description}
                      </Text>
                    )}

                    <Text style={styles.source}>
                      Échéance : {new Date(reminder.dueDate).toLocaleDateString("fr-FR")}
                    </Text>
                  </View>
                ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Traitements en cours</Text>

            {!dashboard || dashboard.activeTreatments.length === 0 ? (
              <Text style={styles.emptyText}>Aucun traitement en cours.</Text>
            ) : (
              dashboard.activeTreatments
                .slice(0, 3)
                .map((treatment: DashboardTreatment) => (
                  <View key={treatment.id} style={styles.actionItem}>
                    <Text style={styles.actionTitle}>
                      {treatment.name}
                      {treatment.dosage ? ` — ${treatment.dosage}` : ""}
                    </Text>

                    {treatment.instructions && (
                      <Text style={styles.actionDescription}>
                        {treatment.instructions}
                      </Text>
                    )}

                    {treatment.isLongTerm ? (
                      <Text style={styles.source}>
                        Traitement longue durée
                        {treatment.daysBeforeRenewal !== null &&
                        treatment.daysBeforeRenewal !== undefined
                          ? ` — renouvellement dans ${treatment.daysBeforeRenewal} jours`
                          : ""}
                      </Text>
                    ) : (
                      <Text style={styles.source}>
                        {treatment.daysRemaining !== null &&
                        treatment.daysRemaining !== undefined
                          ? `${treatment.daysRemaining} jours restants`
                          : "Durée à confirmer"}
                      </Text>
                    )}

                    {treatment.daysBeforeNextDose !== null &&
                      treatment.daysBeforeNextDose !== undefined && (
                        <Text style={styles.source}>
                          Prochaine administration dans{" "}
                          {treatment.daysBeforeNextDose} jours
                        </Text>
                      )}
                  </View>
                ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitleNoMargin}>Vue d’ensemble</Text>

              <TouchableOpacity onPress={refreshDashboard} disabled={isLoadingDashboard}>
                <Text style={styles.refreshText}>
                  {isLoadingDashboard ? "..." : "Actualiser"}
                </Text>
              </TouchableOpacity>
            </View>

            {dashboard ? (
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{dashboard.stats.vigilanceCount}</Text>
                  <Text style={styles.statLabel}>Vigilances</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{dashboard.stats.reminderCount}</Text>
                  <Text style={styles.statLabel}>Rappels</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{dashboard.stats.treatmentCount}</Text>
                  <Text style={styles.statLabel}>Traitements</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{dashboard.stats.documentCount}</Text>
                  <Text style={styles.statLabel}>Documents</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Aucune donnée de dashboard chargée pour le moment.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Actions à vérifier</Text>

            {!dashboard || dashboard.latestActions.length === 0 ? (
              <Text style={styles.emptyText}>Aucune action détectée.</Text>
            ) : (
              dashboard.latestActions.slice(0, 2).map((action: DashboardAction) => (
                <View key={action.id} style={styles.actionItem}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                  <Text style={styles.source}>Source : {action.source}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documents récents</Text>

            {!dashboard || dashboard.recentDocuments.length === 0 ? (
              <Text style={styles.emptyText}>Aucun document importé.</Text>
            ) : (
              dashboard.recentDocuments
                .slice(0, 2)
                .map((document: DashboardDocument) => (
                  <View key={document.id} style={styles.actionItem}>
                    <Text style={styles.actionTitle}>{document.documentType}</Text>
                    <Text style={styles.actionDescription}>{document.filename}</Text>
                    <Text style={styles.source}>
                      Importé le {new Date(document.createdAt).toLocaleString("fr-FR")}
                    </Text>
                  </View>
                ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partages actifs</Text>

            {!dashboard || dashboard.activeShares.length === 0 ? (
              <Text style={styles.emptyText}>Aucun partage actif.</Text>
            ) : (
              dashboard.activeShares
                .slice(0, 2)
                .map((share: DashboardActiveShare) => (
                  <View key={share.id} style={styles.actionItem}>
                    <Text style={styles.actionTitle}>{share.documentType}</Text>
                    <Text style={styles.actionDescription}>{share.actionTitle}</Text>
                    <Text style={styles.source}>
                      Consulté {share.accessCount} fois — expire le{" "}
                      {new Date(share.expiresAt).toLocaleString("fr-FR")}
                    </Text>
                  </View>
                ))
            )}
          </View>

                   <View style={styles.quickActionsCard}>
            <Text style={styles.cardTitle}>Actions rapides</Text>

            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.quickActionPrimary]}
                onPress={startDocumentImport}
              >
                <Text style={styles.quickActionPrimaryText}>Importer</Text>
                <Text style={styles.quickActionSubtext}>Ajouter un PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => setScreen("share")}
              >
                <Text style={styles.quickActionText}>Partager</Text>
                <Text style={styles.quickActionSubtext}>Brief médecin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  setScreen("documents");
                  refreshDocuments();
                }}
              >
                <Text style={styles.quickActionText}>Documents</Text>
                <Text style={styles.quickActionSubtext}>Voir tout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  setScreen("shares");
                  refreshShares();
                }}
              >
                <Text style={styles.quickActionText}>Partages</Text>
                <Text style={styles.quickActionSubtext}>Accès actifs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {screen === "analyzing" && (
        <View style={styles.centeredContainer}>
          <Text style={styles.kicker}>Analyse du document</Text>
          <Text style={styles.title}>Lecture en cours…</Text>
          <Text style={styles.subtitle}>
            Nous analysons le document importé via l’API locale.
          </Text>

          {importedDocument && (
            <View style={styles.filePreview}>
              <Text style={styles.fileLabel}>Document sélectionné</Text>
              <Text style={styles.fileName}>{importedDocument.name}</Text>
            </View>
          )}
        </View>
      )}

      {screen === "review" && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Document analysé</Text>
            <Text style={styles.title}>Informations détectées</Text>
            <Text style={styles.subtitle}>
              Vérifiez les éléments extraits. Modifiez uniquement si quelque chose est incorrect.
            </Text>
          </View>

          {importedDocument && (
            <View style={styles.filePreview}>
              <Text style={styles.fileLabel}>Document importé</Text>
              <Text style={styles.fileName}>{importedDocument.name}</Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitleNoMargin}>Type de document</Text>
              <EditButton
                isEditing={editingSection === "document"}
                onPress={() =>
                  setEditingSection(editingSection === "document" ? null : "document")
                }
              />
            </View>

            {editingSection === "document" ? (
              <TextInput
                style={styles.input}
                value={documentType}
                onChangeText={setDocumentType}
              />
            ) : (
              <Text style={styles.actionTitle}>{documentType}</Text>
            )}

            <Text style={styles.source}>
              Confiance : {Math.round(documentConfidence * 100)} %
            </Text>
          </View>

          <EditableCard
            title="Action détectée"
            editing={editingSection === "action"}
            onToggleEdit={() =>
              setEditingSection(editingSection === "action" ? null : "action")
            }
            fields={
              editingSection === "action" ? (
                <>
                  <Text style={styles.label}>Titre</Text>
                  <TextInput style={styles.input} value={actionTitle} onChangeText={setActionTitle} />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={actionDescription}
                    onChangeText={setActionDescription}
                    multiline
                  />

                  <Text style={styles.label}>Source</Text>
                  <TextInput style={styles.input} value={actionSource} onChangeText={setActionSource} />
                </>
              ) : (
                <>
                  <Text style={styles.actionTitle}>{actionTitle}</Text>
                  <Text style={styles.actionDescription}>{actionDescription}</Text>
                  <Text style={styles.source}>Source : {actionSource}</Text>
                </>
              )
            }
          />

          {hasMedication && (
            <EditableCard
              title="Traitement détecté"
              editing={editingSection === "medication"}
              onToggleEdit={() =>
                setEditingSection(editingSection === "medication" ? null : "medication")
              }
              fields={
                editingSection === "medication" ? (
                  <>
                    <Text style={styles.label}>Nom du médicament</Text>
                    <TextInput
                      style={styles.input}
                      value={medicationName}
                      onChangeText={setMedicationName}
                    />

                    <Text style={styles.label}>Dosage</Text>
                    <TextInput
                      style={styles.input}
                      value={medicationDosage}
                      onChangeText={setMedicationDosage}
                    />

                    <Text style={styles.label}>Instructions</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={medicationInstructions}
                      onChangeText={setMedicationInstructions}
                      multiline
                    />

                    <Text style={styles.label}>Source</Text>
                    <TextInput
                      style={styles.input}
                      value={medicationSource}
                      onChangeText={setMedicationSource}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.actionTitle}>
                      {medicationName} — {medicationDosage}
                    </Text>
                    <Text style={styles.actionDescription}>{medicationInstructions}</Text>
                    <Text style={styles.source}>Source : {medicationSource}</Text>
                  </>
                )
              }
            />
          )}

          {hasObservation && (
            <EditableCard
              title="Point de vigilance détecté"
              editing={editingSection === "observation"}
              onToggleEdit={() =>
                setEditingSection(editingSection === "observation" ? null : "observation")
              }
              fields={
                editingSection === "observation" ? (
                  <>
                    <Text style={styles.label}>Titre</Text>
                    <TextInput
                      style={styles.input}
                      value={observationTitle}
                      onChangeText={setObservationTitle}
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={observationDescription}
                      onChangeText={setObservationDescription}
                      multiline
                    />

                    <Text style={styles.label}>Source</Text>
                    <TextInput
                      style={styles.input}
                      value={observationSource}
                      onChangeText={setObservationSource}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.actionTitle}>{observationTitle}</Text>
                    <Text style={styles.actionDescription}>{observationDescription}</Text>
                    <Text style={styles.source}>Source : {observationSource}</Text>
                  </>
                )
              }
            />
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={confirmExtraction}>
            <Text style={styles.primaryButtonText}>Confirmer et ajouter au carnet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("dashboard")}>
            <Text style={styles.secondaryButtonText}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === "share" && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Partage temporaire</Text>
            <Text style={styles.title}>Partager avec un médecin</Text>
            <Text style={styles.subtitle}>
              Générez un accès temporaire au brief patient. Dans le MVP, ce code est simulé.
            </Text>
          </View>

          <View style={styles.shareCard}>
            <Text style={styles.shareLabel}>Code de partage</Text>
            <Text style={styles.shareCode}>739421</Text>
            <Text style={styles.shareSource}>Expire dans 24 heures</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={openDoctorBrief}>
            <Text style={styles.primaryButtonText}>Ouvrir le brief médecin</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Données partagées</Text>
            <Text style={styles.item}>• Résumé médical</Text>
            <Text style={styles.item}>• Actions en attente</Text>
            <Text style={styles.item}>• Traitements confirmés</Text>
            <Text style={styles.item}>• Points de vigilance</Text>
            <Text style={styles.item}>• Documents sources sélectionnés</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historique d’accès</Text>

            {currentShareId ? (
              <>
                <Text style={styles.item}>• Lien actif : {currentShareId.slice(0, 8)}...</Text>

                {accessCount === null ? (
                  <Text style={styles.emptyText}>Aucun historique chargé pour le moment.</Text>
                ) : (
                  <>
                    <Text style={styles.item}>• Consulté {accessCount} fois</Text>
                    <Text style={styles.item}>
                      • Dernière ouverture :{" "}
                      {latestAccessAt
                        ? new Date(latestAccessAt).toLocaleString("fr-FR")
                        : "Aucune"}
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={refreshAccessLogs}
                  disabled={isLoadingLogs}
                >
                  <Text style={styles.smallButtonText}>
                    {isLoadingLogs ? "Chargement..." : "Actualiser l’historique"}
                  </Text>
                </TouchableOpacity>

                {revokedAt ? (
                  <Text style={styles.revokedText}>
                    Accès révoqué le {new Date(revokedAt).toLocaleString("fr-FR")}
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={revokeCurrentShare}
                    disabled={isRevokingShare}
                  >
                    <Text style={styles.dangerButtonText}>
                      {isRevokingShare ? "Révocation..." : "Révoquer l’accès"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>
                Ouvrez d’abord le brief médecin pour créer un lien de partage.
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setScreen("dashboard")}>
            <Text style={styles.primaryButtonText}>Retour au carnet</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === "shares" && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Contrôle des accès</Text>
            <Text style={styles.title}>Mes partages actifs</Text>
            <Text style={styles.subtitle}>
              Retrouvez les briefs partagés, leur statut, leur historique d’accès et
              révoquez un lien si nécessaire.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={refreshShares}
            disabled={isLoadingShares}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingShares ? "Chargement..." : "Actualiser"}
            </Text>
          </TouchableOpacity>

          {shares.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aucun partage</Text>
              <Text style={styles.emptyText}>Aucun brief partagé pour le moment.</Text>
            </View>
          ) : (
            shares.map((share) => (
              <View key={share.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleNoMargin}>{share.documentType}</Text>
                  <Text
                    style={[
                      styles.statusPill,
                      share.status === "active" && styles.statusActive,
                      share.status === "revoked" && styles.statusRevoked,
                      share.status === "expired" && styles.statusExpired,
                    ]}
                  >
                    {share.status === "active"
                      ? "Actif"
                      : share.status === "revoked"
                      ? "Révoqué"
                      : "Expiré"}
                  </Text>
                </View>

                <Text style={styles.actionTitle}>{share.actionTitle}</Text>
                <Text style={styles.source}>Source : {share.source}</Text>
                <Text style={styles.item}>
                  • Créé le {new Date(share.createdAt).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.item}>
                  • Expire le {new Date(share.expiresAt).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.item}>• Consulté {share.accessCount} fois</Text>

                {share.latestAccessAt && (
                  <Text style={styles.item}>
                    • Dernière ouverture :{" "}
                    {new Date(share.latestAccessAt).toLocaleString("fr-FR")}
                  </Text>
                )}

                <Text style={styles.source}>ID : {share.id.slice(0, 8)}...</Text>

                {share.status === "active" && (
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={() => revokeShareById(share.id)}
                  >
                    <Text style={styles.dangerButtonText}>Révoquer l’accès</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={() => setScreen("dashboard")}>
            <Text style={styles.primaryButtonText}>Retour au carnet</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
	        {screen === "documents" && (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Documents importés</Text>
            <Text style={styles.title}>Mes documents</Text>
            <Text style={styles.subtitle}>
              Retrouvez les documents médicaux importés, les informations extraites et
              les partages associés.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={refreshDocuments}
            disabled={isLoadingDocuments}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingDocuments ? "Chargement..." : "Actualiser"}
            </Text>
          </TouchableOpacity>

          {documents.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aucun document</Text>
              <Text style={styles.emptyText}>
                Aucun document importé pour le moment.
              </Text>
            </View>
          ) : (
            documents.map((document: PatientDocument) => (
              <View key={document.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleNoMargin}>
                    {document.documentType}
                  </Text>
                  <Text style={styles.documentPill}>
                    {Math.round(document.confidence * 100)} %
                  </Text>
                </View>

                <Text style={styles.actionTitle}>{document.filename}</Text>

                <Text style={styles.source}>
                  Importé le {new Date(document.createdAt).toLocaleString("fr-FR")}
                </Text>

                <Text style={styles.source}>Source : {document.source}</Text>

                <View style={styles.sectionDivider} />

                <Text style={styles.label}>Action extraite</Text>
                <Text style={styles.actionTitle}>{document.actionTitle}</Text>
                <Text style={styles.actionDescription}>
                  {document.actionDescription}
                </Text>

                {document.observationTitle && (
                  <>
                    <Text style={styles.label}>Point de vigilance</Text>
                    <Text style={styles.actionTitle}>
                      {document.observationTitle}
                    </Text>
                    <Text style={styles.actionDescription}>
                      {document.observationDescription}
                    </Text>
                  </>
                )}

                {document.medicationName && (
                  <>
                    <Text style={styles.label}>Traitement détecté</Text>
                    <Text style={styles.actionTitle}>
                      {document.medicationName}
                      {document.medicationDosage
                        ? ` — ${document.medicationDosage}`
                        : ""}
                    </Text>
                  </>
                )}

                <View style={styles.sectionDivider} />

                <Text style={styles.item}>
                  • Partages créés : {document.shareCount}
                </Text>
                <Text style={styles.item}>
                  • Partages actifs : {document.activeShareCount}
                </Text>

                <Text style={styles.source}>ID : {document.id.slice(0, 8)}...</Text>
				
				<TouchableOpacity
 				  style={styles.dangerButton}
				  onPress={() => deleteDocumentById(document.id)}
>				 <Text style={styles.dangerButtonText}>Supprimer le document</Text>
				</TouchableOpacity>
			  </View>
            ))
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setScreen("dashboard")}
          >
            <Text style={styles.primaryButtonText}>Retour au carnet</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EditableCard({
  title,
  editing,
  onToggleEdit,
  fields,
}: {
  title: string;
  editing: boolean;
  onToggleEdit: () => void;
  fields: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitleNoMargin}>{title}</Text>
        <EditButton isEditing={editing} onPress={onToggleEdit} />
      </View>
      {fields}
    </View>
  );
}

function EditButton({
  isEditing,
  onPress,
}: {
  isEditing: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.editButton} onPress={onPress}>
      <Text style={styles.editButtonText}>{isEditing ? "Terminer" : "✎ Modifier"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  container: { padding: 24, gap: 18 },
  centeredContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#F4F7FB",
  },
  header: { marginTop: 24, marginBottom: 8 },
  kicker: { fontSize: 14, fontWeight: "700", color: "#4776A8", marginBottom: 8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", color: "#172033" },
  subtitle: { marginTop: 12, fontSize: 16, lineHeight: 23, color: "#536179" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#172033", marginBottom: 14 },
  cardTitleNoMargin: { fontSize: 18, fontWeight: "800", color: "#172033", flex: 1 },
  editButton: {
    backgroundColor: "#E5EDF7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editButtonText: { color: "#172033", fontSize: 13, fontWeight: "800" },
  actionItem: {
    paddingVertical: 10,
    borderBottomColor: "#E8EDF5",
    borderBottomWidth: 1,
  },
  actionTitle: { fontSize: 16, fontWeight: "800", color: "#172033" },
  actionDescription: { marginTop: 4, fontSize: 14, color: "#536179" },
  source: { marginTop: 6, fontSize: 13, color: "#7C879A" },
  emptyText: { fontSize: 14, color: "#7C879A" },
  item: { fontSize: 15, color: "#172033", marginBottom: 8 },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#536179",
  },
  input: {
    backgroundColor: "#F4F7FB",
    borderWidth: 1,
    borderColor: "#DDE6F2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#172033",
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  primaryButton: {
    backgroundColor: "#172033",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    backgroundColor: "#E5EDF7",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#172033", fontWeight: "800", fontSize: 16 },
  smallButton: {
    marginTop: 14,
    backgroundColor: "#E5EDF7",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallButtonText: {
    color: "#172033",
    fontWeight: "800",
    fontSize: 14,
  },
  dangerButton: {
    marginTop: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#991B1B",
    fontWeight: "800",
    fontSize: 14,
  },
  revokedText: {
    marginTop: 12,
    color: "#991B1B",
    fontWeight: "800",
    fontSize: 14,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
  },
  statusActive: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  statusRevoked: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  statusExpired: {
    backgroundColor: "#E5E7EB",
    color: "#374151",
  },
  shareCard: {
    backgroundColor: "#172033",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  shareLabel: { color: "#B7C6DA", fontSize: 14, fontWeight: "700" },
  shareCode: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
  },
  shareSource: { marginTop: 8, fontSize: 13, color: "#B7C6DA" },
  filePreview: {
    backgroundColor: "#E5EDF7",
    borderRadius: 20,
    padding: 16,
  },
  fileLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4776A8",
    marginBottom: 4,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#172033",
  },
    documentPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    backgroundColor: "#E5EDF7",
    color: "#172033",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E8EDF5",
    marginVertical: 14,
  },
    reminderPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  refreshText: {
  color: "#4776A8",
  fontWeight: "800",
  fontSize: 13,
},
statsGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,
},
statBox: {
  width: "47%",
  backgroundColor: "#F4F7FB",
  borderRadius: 18,
  padding: 14,
},
statNumber: {
  fontSize: 28,
  fontWeight: "900",
  color: "#172033",
},
statLabel: {
  marginTop: 4,
  fontSize: 13,
  fontWeight: "700",
  color: "#536179",
},
  quickActionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionButton: {
    width: "48%",
    backgroundColor: "#E5EDF7",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  quickActionPrimary: {
    backgroundColor: "#172033",
  },
  quickActionText: {
    color: "#172033",
    fontWeight: "900",
    fontSize: 15,
  },
  quickActionPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  quickActionSubtext: {
    marginTop: 4,
    color: "#7C879A",
    fontSize: 12,
    fontWeight: "700",
  },
});
