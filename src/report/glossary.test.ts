import { describe, expect, it } from "vitest";
import { renderMarkdownHowToRead, renderTableGlossary } from "./glossary.js";

const REQUIRED_TERMS = [
  "Score",
  "NLOC",
  "NLOCN",
  "Churn",
  "ChurnN",
  "Authors",
  "Lines",
] as const;

describe("glossary", () => {
  it("renderTableGlossary returns a footer with a Glossary header", () => {
    const lines = renderTableGlossary();

    expect(lines[0]).toBe("Glossary");
    expect(lines.length).toBeGreaterThan(REQUIRED_TERMS.length);
  });

  it("renderTableGlossary defines all locked metric terms", () => {
    const output = renderTableGlossary().join("\n");

    for (const term of REQUIRED_TERMS) {
      expect(output).toContain(term);
    }
    expect(output).toContain("Non-commented lines of code");
    expect(output).not.toContain("McCabe");
  });

  it("renderMarkdownHowToRead returns the How to read this section", () => {
    const lines = renderMarkdownHowToRead();

    expect(lines[0]).toBe("## How to read this");
    expect(lines).toContain("");
  });

  it("renderMarkdownHowToRead defines the same metric terms as the table glossary", () => {
    const tableText = renderTableGlossary().join("\n");
    const markdownText = renderMarkdownHowToRead().join("\n");

    for (const term of REQUIRED_TERMS) {
      expect(tableText).toContain(term);
      expect(markdownText).toContain(`**${term}**`);
    }
  });

  it("renderMarkdownHowToRead mentions rank deltas when compare is true", () => {
    const scanLines = renderMarkdownHowToRead();
    const compareLines = renderMarkdownHowToRead({ compare: true });

    expect(compareLines.join("\n")).toContain("rank delta");
    expect(scanLines.join("\n")).not.toContain("rank delta");
  });

  it("table and markdown share the same term count", () => {
    expect(renderTableGlossary().length - 1).toBe(REQUIRED_TERMS.length);
    expect(
      renderMarkdownHowToRead().filter((line) => line.startsWith("- **")).length,
    ).toBe(REQUIRED_TERMS.length);
  });
});
