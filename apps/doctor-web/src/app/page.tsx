export const dynamic = "force-dynamic";

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

type PageProps = {
  searchParams?: Promise<{
    shareId?: string;
  }>;
};

const fallbackBrief: SharedBrief = {
  id: "demo",
  code: "739421",
  documentType: "Analyse biologique",
  actionTitle: "Discuter le bilan rénal + potassium avec le médecin",
  actionDescription:
    "Analyse détectée comme bilan de suivi après introduction d’un traitement.",
  observationTitle: "Glycémie à jeun limite haute",
  observationDescription:
    "Point de vigilance à recontrôler ou contextualiser avec le médecin.",
  medicationName: "",
  medicationDosage: "",
  source: "Analyse biologique — 15/05/2026",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

async function getSharedBrief(shareId?: string): Promise<SharedBrief | null> {
  if (!shareId) {
    return fallbackBrief;
  }

  try {
    const response = await fetch(`http://localhost:4000/shares/${shareId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const shareId = params?.shareId;

  const brief = await getSharedBrief(shareId);

  if (!brief) {
    return (
      <main className="min-h-screen bg-slate-100 px-8 py-10 text-slate-900">
        <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-bold text-blue-700">
            Continuum Santé — Espace professionnel
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">
            Brief introuvable
          </h1>
          <p className="mt-3 text-slate-600">
            Le partage n’existe pas, a expiré, ou l’API locale ne répond pas.
          </p>
          <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
            Vérifie que l’API tourne sur{" "}
            <strong>http://localhost:4000</strong>.
          </p>
        </section>
      </main>
    );
  }

  const hasObservation = Boolean(brief.observationTitle);
  const hasMedication = Boolean(brief.medicationName);

  return (
    <main className="min-h-screen bg-slate-100 px-8 py-10 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-bold text-blue-700">
            Continuum Santé — Espace professionnel
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            Brief patient
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Synthèse médicale courte, sourcée et partageable temporairement avec
            un professionnel de santé.
          </p>
        </div>

        <div className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold text-slate-300">
            Code de partage
          </p>
          <p className="mt-2 text-4xl font-black tracking-widest">
            {brief.code}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Accès temporaire — expire le{" "}
            {new Date(brief.expiresAt).toLocaleString("fr-FR")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Résumé rapide</h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold">Document principal</p>
                <p className="mt-1 text-slate-600">{brief.documentType}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold">Action détectée</p>
                <p className="mt-1 font-medium">{brief.actionTitle}</p>
                <p className="mt-1 text-slate-600">
                  {brief.actionDescription}
                </p>
              </div>

              {hasObservation && (
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">
                    Point de vigilance
                  </p>
                  <p className="mt-1 font-medium text-amber-900">
                    {brief.observationTitle}
                  </p>
                  <p className="mt-1 text-amber-900/80">
                    {brief.observationDescription}
                  </p>
                </div>
              )}

              {hasMedication && (
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="font-semibold text-blue-900">
                    Traitement détecté
                  </p>
                  <p className="mt-1 text-blue-900">
                    {brief.medicationName}{" "}
                    {brief.medicationDosage &&
                      `— ${brief.medicationDosage}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">À vérifier</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>Les résultats ont-ils été revus par le médecin ?</li>
                <li>Le contexte clinique justifie-t-il un contrôle ?</li>
                <li>Les traitements actuels sont-ils bien à jour ?</li>
              </ul>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Document source</h2>
              <p className="mt-4 text-sm text-slate-600">{brief.source}</p>
              <p className="mt-3 text-xs text-slate-400">
                Les affirmations du brief doivent rester vérifiables à partir
                des documents originaux.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Timeline médicale</h2>
          <div className="mt-5 space-y-4">
            <div>
              <p className="font-semibold">
                {new Date(brief.createdAt).toLocaleDateString("fr-FR")} —{" "}
                {brief.documentType}
              </p>
              <p className="text-slate-600">{brief.source}</p>
            </div>
            <div>
              <p className="font-semibold">Action proposée</p>
              <p className="text-slate-600">{brief.actionTitle}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}