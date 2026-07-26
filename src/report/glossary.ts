type GlossaryEntry = {
  term: string;
  definition: string;
};

/** Shared metric definitions for table footer and markdown how-to-read. */
const METRIC_GLOSSARY: readonly GlossaryEntry[] = [
  {
    term: "Score",
    definition:
      "Hotspot score: harmonic mean of normalized complexity and churn (0–1); higher means hotter.",
  },
  {
    term: "Cpx",
    definition: "Raw McCabe cyclomatic complexity for the file or function.",
  },
  {
    term: "CpxN",
    definition:
      "Complexity normalized with log1p + min-max across the scan (0–1).",
  },
  {
    term: "Churn",
    definition:
      "Commit count touching the file or function in the scan window.",
  },
  {
    term: "ChurnN",
    definition: "Churn normalized with log1p + min-max across the scan (0–1).",
  },
  {
    term: "Funcs",
    definition: "Number of functions in the file (hotspot ranking rows).",
  },
  {
    term: "Authors",
    definition:
      "Distinct authors who changed the file or function in the scan window.",
  },
  {
    term: "Lines",
    definition:
      "Total lines changed in the scan window (markdown hotspot/function tables).",
  },
  {
    term: "ParseFail",
    definition:
      "Whether AST parse failed for the file (yes/no); failed files rank with score 0.",
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
export function renderMarkdownHowToRead(options?: {
  compare?: boolean;
}): string[] {
  const lines = ["## How to read this", ""];

  if (options?.compare) {
    lines.push(
      "Compare reports use the same metrics on the **current** snapshot. Rank-change tables add baseline rank, current rank, and rank delta alongside the columns below.",
      "",
    );
  }

  for (const { term, definition } of METRIC_GLOSSARY) {
    lines.push(`- **${term}** — ${definition}`);
  }

  return lines;
}
