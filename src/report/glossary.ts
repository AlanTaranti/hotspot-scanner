type GlossaryEntry = {
  term: string;
  definition: string;
};

/** Shared metric definitions for table footer and markdown how-to-read. */
const METRIC_GLOSSARY: readonly GlossaryEntry[] = [
  {
    term: "Score",
    definition:
      "Hotspot score: harmonic mean of normalized NCLOC and churn (0–1); higher means hotter.",
  },
  {
    term: "NLOC",
    definition: "Non-commented lines of code in the file.",
  },
  {
    term: "NLOCN",
    definition:
      "NCLOC normalized with log1p + min-max across the scan (0–1).",
  },
  {
    term: "Churn",
    definition: "Commit count touching the file in the scan window.",
  },
  {
    term: "ChurnN",
    definition: "Churn normalized with log1p + min-max across the scan (0–1).",
  },
  {
    term: "Authors",
    definition:
      "Distinct authors who changed the file in the scan window.",
  },
  {
    term: "Lines",
    definition:
      "Total lines changed in the scan window (hotspot tables).",
  },
];

/** Table footer lines defining ranking column metrics. */
export function renderTableGlossary(): string[] {
  return [
    "Glossary",
    ...METRIC_GLOSSARY.map(
      ({ term, definition }) => `  ${term.padEnd(12)}${definition}`,
    ),
  ];
}

/** GFM `## How to read this` section with the same metric semantics as the table glossary. */
export function renderMarkdownHowToRead(): string[] {
  const lines = ["## How to read this", ""];

  for (const { term, definition } of METRIC_GLOSSARY) {
    lines.push(`- **${term}** — ${definition}`);
  }

  return lines;
}
