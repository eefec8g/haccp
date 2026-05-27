import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import {
  ALERTE_STATUS_PDF_LABELS,
  CRENEAU_PDF_LABELS,
  PDF_COLOR_NOIR,
  PDF_COLOR_NOIR_60,
  PDF_COLOR_OR,
  PDF_FOOTER_PREFIX,
} from '@/lib/constants/export';
import {
  PDF_CONSOLIDE_ALERTES_SECTION_TITLE,
  PDF_CONSOLIDE_BOUTIQUES_LABEL,
  PDF_CONSOLIDE_FOOTER_MENTION,
  PDF_CONSOLIDE_FOOTER_MENTION_CORRECTIONS,
  PDF_CONSOLIDE_NO_ALERTES_LABEL,
  PDF_CONSOLIDE_NO_RELEVES_LABEL,
  PDF_CONSOLIDE_NO_SIGNATURES_LABEL,
  PDF_CONSOLIDE_PERIODE_LABEL,
  PDF_CONSOLIDE_RELEVES_SECTION_TITLE,
  PDF_CONSOLIDE_SIGNATURES_SECTION_TITLE,
  PDF_CONSOLIDE_STATS_ALERTES_OUVERTES,
  PDF_CONSOLIDE_STATS_ALERTES_TRAITEES,
  PDF_CONSOLIDE_STATS_JOURS_SIGNES,
  PDF_CONSOLIDE_STATS_MANQUANTS,
  PDF_CONSOLIDE_STATS_SECTION_TITLE,
  PDF_CONSOLIDE_STATS_TAUX_CONFORMITE,
  PDF_CONSOLIDE_STATS_TAUX_RESOLUTION,
  PDF_CONSOLIDE_STATS_TOTAL_ALERTES,
  PDF_CONSOLIDE_STATS_TOTAL_ATTENDUS,
  PDF_CONSOLIDE_STATS_TOTAL_SAISIS,
  PDF_CONSOLIDE_STATS_TOTAL_SIGNATURES,
  PDF_CONSOLIDE_SUBTITLE,
  PDF_CONSOLIDE_TITLE,
} from '@/lib/constants/export-consolide';
import { formatDateShort } from '@/lib/utils/dates';
import {
  CENTER,
  PARIS_DATETIME,
  buildBrandHeader,
  getPrinter,
} from '@/lib/utils/pdf-utils';
import type {
  BoutiqueSummary,
  ConsolideAlerte,
  ConsolideJour,
  ConsolideJourEquipement,
  ConsolideJourReleves,
  ConsolideReleveCell,
  ConsolideSignature,
  RegistreConsolide,
  RegistreConsolideStats,
} from '@/types/export-consolide';

/**
 * Generateur PDF "Registre journalier consolide" (Epic REGISTRE US-REG-001).
 *
 * Architecture : 1 fonction = 1 sous-bloc PDF (strict SRP <20 lignes,
 * cf. CC-2). Le doc definition est l'assemblage de ces blocs.
 *
 * Tous les utilitaires partages (FONTS, getPrinter lazy, PARIS_DATETIME,
 * buildBrandHeader) viennent de `@/lib/utils/pdf-utils` (CC-1, DRY).
 *
 * Mentions de pied de page : la note `_FOOTER_MENTION_CORRECTIONS` est
 * affichee en footer pour conformite traceabilite des corrections
 * (BL-1) -- l'historique complet (releve annule + remplacant) est
 * trace dans le registre journalier detaille (CSV/PDF).
 */

const MISSING_LABEL = '-';

// CC-2 : orientation landscape -> ligne brand decalee (largeur 297mm).
const LANDSCAPE_BRAND_LINE_X2 = 400;
const LANDSCAPE_BRAND_MARGIN_BOTTOM = 18;

function buildBrandBlock(): Content {
  return buildBrandHeader({
    lineX2: LANDSCAPE_BRAND_LINE_X2,
    marginBottom: LANDSCAPE_BRAND_MARGIN_BOTTOM,
  });
}

function buildTitleSubtitle(): Content {
  return {
    text: PDF_CONSOLIDE_SUBTITLE,
    fontSize: 9,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
    margin: [0, 4, 0, 0],
  };
}

function buildTitleBlock(): Content {
  return {
    stack: [
      {
        text: PDF_CONSOLIDE_TITLE,
        fontSize: 14,
        bold: true,
        characterSpacing: 3,
        color: PDF_COLOR_NOIR,
        alignment: CENTER,
      },
      buildTitleSubtitle(),
    ],
    margin: [0, 0, 0, 14],
  };
}

interface PeriodeBlockArgs {
  readonly periode: RegistreConsolide['periode'];
  readonly boutiques: readonly BoutiqueSummary[];
}

function formatBoutiqueLabel(boutique: BoutiqueSummary): string {
  return boutique.ville ? `${boutique.nom} (${boutique.ville})` : boutique.nom;
}

function formatBoutiques(boutiques: readonly BoutiqueSummary[]): string {
  if (boutiques.length === 0) {
    return MISSING_LABEL;
  }
  return boutiques.map((b) => formatBoutiqueLabel(b)).join(', ');
}

function buildPeriodeBlock({ periode, boutiques }: PeriodeBlockArgs): Content {
  const range = `${formatDateShort(periode.dateStart)} - ${formatDateShort(periode.dateEnd)} (${periode.jours} j)`;
  return {
    stack: [
      {
        text: `${PDF_CONSOLIDE_PERIODE_LABEL} : ${range}`,
        fontSize: 11,
        bold: true,
        color: PDF_COLOR_NOIR,
      },
      {
        text: `${PDF_CONSOLIDE_BOUTIQUES_LABEL} : ${formatBoutiques(boutiques)}`,
        fontSize: 9,
        color: PDF_COLOR_NOIR_60,
        margin: [0, 2, 0, 0],
      },
    ],
    margin: [0, 0, 0, 14],
  };
}

/**
 * Cellule d'en-tete generique (bold + fontSize 9) reutilisee par tous
 * les builders de header de la matrice consolidee. Garde les builders
 * sous la barre des 20 lignes.
 */
function headerCell(
  text: string,
  options: { readonly center?: boolean } = {}
): TableCell {
  return options.center
    ? { text, bold: true, fontSize: 9, alignment: CENTER }
    : { text, bold: true, fontSize: 9 };
}

function buildMatriceHeaderRow(): TableCell[] {
  return [
    headerCell('Date'),
    headerCell('Equipement'),
    headerCell('Boutique'),
    headerCell(CRENEAU_PDF_LABELS.MATIN, { center: true }),
    headerCell(CRENEAU_PDF_LABELS.MIDI, { center: true }),
    headerCell(CRENEAU_PDF_LABELS.SOIR, { center: true }),
  ];
}

function buildCreneauCell(cell: ConsolideReleveCell | null): TableCell {
  if (!cell) {
    return {
      text: MISSING_LABEL,
      fontSize: 9,
      alignment: CENTER,
      color: PDF_COLOR_NOIR_60,
    };
  }
  return {
    text: `${cell.temperature.toFixed(1)} degC`,
    fontSize: 9,
    alignment: CENTER,
    color: cell.alerte ? PDF_COLOR_OR : PDF_COLOR_NOIR,
    bold: cell.alerte,
  };
}

interface MatriceRowArgs {
  readonly dateISO: string;
  readonly equipement: ConsolideJourEquipement;
}

function buildMatriceRow({ dateISO, equipement }: MatriceRowArgs): TableCell[] {
  const releves: ConsolideJourReleves = equipement.releves;
  return [
    { text: formatDateShort(dateISO), fontSize: 9 },
    { text: equipement.equipementNom, fontSize: 9 },
    { text: equipement.boutiqueNom, fontSize: 9 },
    buildCreneauCell(releves.matin),
    buildCreneauCell(releves.midi),
    buildCreneauCell(releves.soir),
  ];
}

function buildMatriceRows(jours: readonly ConsolideJour[]): TableCell[][] {
  const rows: TableCell[][] = [];
  for (const jour of jours) {
    for (const equipement of jour.equipements) {
      rows.push(buildMatriceRow({ dateISO: jour.dateISO, equipement }));
    }
  }
  return rows;
}

const MATRICE_WIDTHS = [60, '*', '*', 50, 50, 50] as const;

function buildMatriceTable(dataRows: TableCell[][]): Content {
  return {
    table: {
      headerRows: 1,
      widths: [...MATRICE_WIDTHS],
      body: [buildMatriceHeaderRow(), ...dataRows],
    },
    layout: 'lightHorizontalLines',
  };
}

function buildMatriceConsolidee(jours: readonly ConsolideJour[]): Content {
  const dataRows = buildMatriceRows(jours);
  if (dataRows.length === 0) {
    return buildSectionPlaceholder(
      PDF_CONSOLIDE_RELEVES_SECTION_TITLE,
      PDF_CONSOLIDE_NO_RELEVES_LABEL
    );
  }
  return {
    stack: [
      buildSectionTitle(PDF_CONSOLIDE_RELEVES_SECTION_TITLE),
      buildMatriceTable(dataRows),
    ],
    margin: [0, 0, 0, 14],
  };
}

function buildSectionTitle(title: string): Content {
  return {
    text: title,
    fontSize: 11,
    bold: true,
    color: PDF_COLOR_NOIR,
    margin: [0, 0, 0, 6],
  };
}

function buildSectionPlaceholder(title: string, label: string): Content {
  return {
    stack: [
      buildSectionTitle(title),
      {
        text: label,
        fontSize: 9,
        italics: true,
        color: PDF_COLOR_NOIR_60,
      },
    ],
    margin: [0, 0, 0, 14],
  };
}

function buildStatsKpiContent(label: string, value: string): TableCell {
  return {
    stack: [
      {
        text: label,
        fontSize: 7,
        characterSpacing: 1,
        color: PDF_COLOR_NOIR_60,
      },
      {
        text: value,
        fontSize: 13,
        bold: true,
        color: PDF_COLOR_NOIR,
        margin: [0, 3, 0, 0],
      },
    ],
    margin: [4, 6, 4, 6],
  };
}

/**
 * Definition declarative d'un KPI = (label affiche, extractor depuis
 * `RegistreConsolideStats`). Top-level `as const` pour figer la
 * configuration : reorganiser les rangees ne change ni le builder, ni
 * les tests. CC-2 : `buildStatsBlock` devient un `map` simple.
 */
interface StatsKpi {
  readonly label: string;
  readonly value: (stats: RegistreConsolideStats) => string;
}

const PERCENT_SUFFIX = ' %';
const EMPTY_KPI_CELL: TableCell = {
  text: '',
  border: [false, false, false, false],
};

const STATS_KPIS_ROW1: readonly StatsKpi[] = [
  {
    label: PDF_CONSOLIDE_STATS_TAUX_CONFORMITE,
    value: (s) => `${s.tauxConformite}${PERCENT_SUFFIX}`,
  },
  {
    label: PDF_CONSOLIDE_STATS_TOTAL_SAISIS,
    value: (s) => String(s.totalRelevesSaisis),
  },
  {
    label: PDF_CONSOLIDE_STATS_TOTAL_ATTENDUS,
    value: (s) => String(s.totalRelevesAttendus),
  },
  {
    label: PDF_CONSOLIDE_STATS_MANQUANTS,
    value: (s) => String(s.relevesManquants),
  },
] as const;

const STATS_KPIS_ROW2: readonly StatsKpi[] = [
  {
    label: PDF_CONSOLIDE_STATS_TOTAL_ALERTES,
    value: (s) => String(s.totalAlertes),
  },
  {
    label: PDF_CONSOLIDE_STATS_ALERTES_OUVERTES,
    value: (s) => String(s.alertesOuvertes),
  },
  {
    label: PDF_CONSOLIDE_STATS_ALERTES_TRAITEES,
    value: (s) => String(s.alertesTraitees),
  },
  {
    label: PDF_CONSOLIDE_STATS_TAUX_RESOLUTION,
    value: (s) => `${s.tauxResolutionAlertes}${PERCENT_SUFFIX}`,
  },
] as const;

const STATS_KPIS_ROW3: readonly StatsKpi[] = [
  {
    label: PDF_CONSOLIDE_STATS_TOTAL_SIGNATURES,
    value: (s) => String(s.totalSignatures),
  },
  {
    label: PDF_CONSOLIDE_STATS_JOURS_SIGNES,
    value: (s) => String(s.joursAvecSignature),
  },
] as const;

function buildStatsKpiCell(
  kpi: StatsKpi,
  stats: RegistreConsolideStats
): TableCell {
  return buildStatsKpiContent(kpi.label, kpi.value(stats));
}

function buildKpiRow(
  kpis: readonly StatsKpi[],
  stats: RegistreConsolideStats,
  padTo = 4
): TableCell[] {
  const row = kpis.map((kpi) => buildStatsKpiCell(kpi, stats));
  while (row.length < padTo) {
    row.push(EMPTY_KPI_CELL);
  }
  return row;
}

function buildStatsBlock(stats: RegistreConsolideStats): Content {
  return {
    stack: [
      buildSectionTitle(PDF_CONSOLIDE_STATS_SECTION_TITLE),
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            buildKpiRow(STATS_KPIS_ROW1, stats),
            buildKpiRow(STATS_KPIS_ROW2, stats),
            buildKpiRow(STATS_KPIS_ROW3, stats),
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    margin: [0, 0, 0, 14],
  };
}

function alerteTempCell(alerte: ConsolideAlerte): TableCell {
  return {
    text: `${alerte.temperature.toFixed(1)} degC`,
    fontSize: 8,
    alignment: CENTER,
    color: PDF_COLOR_OR,
    bold: true,
  };
}

function alerteCreneauCell(alerte: ConsolideAlerte): TableCell {
  return {
    text: CRENEAU_PDF_LABELS[alerte.creneau],
    fontSize: 8,
    alignment: CENTER,
  };
}

function buildAlerteRow(alerte: ConsolideAlerte): TableCell[] {
  return [
    { text: formatDateShort(alerte.dateISO), fontSize: 8 },
    { text: alerte.equipementNom, fontSize: 8 },
    { text: alerte.boutiqueNom, fontSize: 8 },
    alerteTempCell(alerte),
    alerteCreneauCell(alerte),
    { text: ALERTE_STATUS_PDF_LABELS[alerte.statut], fontSize: 8 },
    { text: alerte.motif ?? MISSING_LABEL, fontSize: 8 },
    { text: alerte.salarieNom, fontSize: 8 },
    { text: alerte.traiteParNom ?? MISSING_LABEL, fontSize: 8 },
  ];
}

function smallHeaderCell(
  text: string,
  options: { readonly center?: boolean } = {}
): TableCell {
  return options.center
    ? { text, bold: true, fontSize: 8, alignment: CENTER }
    : { text, bold: true, fontSize: 8 };
}

function buildAlertesTableHeader(): TableCell[] {
  return [
    smallHeaderCell('Date'),
    smallHeaderCell('Equipement'),
    smallHeaderCell('Boutique'),
    smallHeaderCell('Temp.', { center: true }),
    smallHeaderCell('Creneau', { center: true }),
    smallHeaderCell('Statut'),
    smallHeaderCell('Motif'),
    smallHeaderCell('Salarie'),
    smallHeaderCell('Traite par'),
  ];
}

function buildAlertesEmptyState(): Content {
  return buildSectionPlaceholder(
    PDF_CONSOLIDE_ALERTES_SECTION_TITLE,
    PDF_CONSOLIDE_NO_ALERTES_LABEL
  );
}

function buildAlertesList(alertes: readonly ConsolideAlerte[]): Content {
  if (alertes.length === 0) {
    return buildAlertesEmptyState();
  }
  return {
    stack: [
      buildSectionTitle(PDF_CONSOLIDE_ALERTES_SECTION_TITLE),
      {
        table: {
          headerRows: 1,
          widths: [50, '*', '*', 40, 40, 50, '*', '*', '*'],
          body: [buildAlertesTableHeader(), ...alertes.map(buildAlerteRow)],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    margin: [0, 0, 0, 14],
  };
}

function buildSignatureRow(signature: ConsolideSignature): TableCell[] {
  return [
    { text: formatDateShort(signature.dateISO), fontSize: 9 },
    { text: signature.boutiqueNom, fontSize: 9 },
    { text: signature.signataireNom, fontSize: 9 },
    { text: signature.signataireRoleSnapshot, fontSize: 9 },
    { text: PARIS_DATETIME.format(signature.signedAt), fontSize: 9 },
  ];
}

function buildSignaturesTableHeader(): TableCell[] {
  return [
    headerCell('Date'),
    headerCell('Boutique'),
    headerCell('Signataire'),
    headerCell('Role'),
    headerCell('Signe le'),
  ];
}

function buildSignaturesEmptyState(): Content {
  return {
    pageBreak: 'before',
    stack: [
      buildSectionTitle(PDF_CONSOLIDE_SIGNATURES_SECTION_TITLE),
      {
        text: PDF_CONSOLIDE_NO_SIGNATURES_LABEL,
        fontSize: 9,
        italics: true,
        color: PDF_COLOR_NOIR_60,
      },
    ],
  };
}

const SIGNATURES_WIDTHS = [60, '*', '*', 70, 90] as const;

function buildSignaturesTable(
  signatures: readonly ConsolideSignature[]
): Content {
  return {
    table: {
      headerRows: 1,
      widths: [...SIGNATURES_WIDTHS],
      body: [
        buildSignaturesTableHeader(),
        ...signatures.map(buildSignatureRow),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

function buildSignaturesAnnexe(
  signatures: readonly ConsolideSignature[]
): Content {
  if (signatures.length === 0) {
    return buildSignaturesEmptyState();
  }
  return {
    pageBreak: 'before',
    stack: [
      buildSectionTitle(PDF_CONSOLIDE_SIGNATURES_SECTION_TITLE),
      buildSignaturesTable(signatures),
    ],
  };
}

function buildFooterMentionDDPP(): Content {
  return {
    text: PDF_CONSOLIDE_FOOTER_MENTION,
    fontSize: 8,
    italics: true,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
  };
}

function buildFooterMentionCorrections(): Content {
  return {
    text: PDF_CONSOLIDE_FOOTER_MENTION_CORRECTIONS,
    fontSize: 8,
    italics: true,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
    margin: [0, 2, 0, 0],
  };
}

function buildFooterGeneratedAt(): Content {
  const generatedAt = PARIS_DATETIME.format(new Date());
  return {
    text: `${PDF_FOOTER_PREFIX} HACCP Maison Givre le ${generatedAt} (Europe/Paris)`,
    fontSize: 8,
    italics: true,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
    margin: [0, 2, 0, 0],
  };
}

function buildConsolideFooter(): Content {
  return {
    stack: [
      buildFooterMentionDDPP(),
      buildFooterMentionCorrections(),
      buildFooterGeneratedAt(),
    ],
    margin: [0, 10, 0, 0],
  };
}

function buildDocDefinition(data: RegistreConsolide): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [32, 36, 32, 36],
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: PDF_COLOR_NOIR },
    content: [
      buildBrandBlock(),
      buildTitleBlock(),
      buildPeriodeBlock({ periode: data.periode, boutiques: data.boutiques }),
      buildStatsBlock(data.stats),
      buildMatriceConsolidee(data.jours),
      buildAlertesList(data.alertes),
      buildSignaturesAnnexe(data.signatures),
      buildConsolideFooter(),
    ],
  };
}

/**
 * Produit le buffer PDF complet du registre consolide.
 *
 * Async pour homogeneite avec `buildRegistreJournalierPdf` (qui doit
 * etre async pour resoudre l'image de signature) ET pour le lazy
 * `getPrinter()` (`await import('pdfmake/src/printer')`) -- PERF-1.
 */
export async function buildRegistreConsolidePdf(
  data: RegistreConsolide
): Promise<Buffer> {
  const docDefinition = buildDocDefinition(data);
  const printer = await getPrinter();
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err: Error) => reject(err));
    pdfDoc.end();
  });
}
