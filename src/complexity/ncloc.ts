type ScanMode =
  | "code"
  | "lineComment"
  | "blockComment"
  | "singleQuote"
  | "doubleQuote"
  | "template";

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r";
}

function finishLine(lineHasCode: boolean, ncloc: number): {
  lineHasCode: boolean;
  ncloc: number;
} {
  if (!lineHasCode) {
    return { lineHasCode: false, ncloc };
  }
  return { lineHasCode: false, ncloc: ncloc + 1 };
}

/** Count non-commented lines of code in a UTF-8 source string. */
export function countNcloc(source: string): number {
  let mode: ScanMode = "code";
  let ncloc = 0;
  let lineHasCode = false;
  let escaped = false;
  let templateExpressionDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];

    if (char === "\n") {
      ({ lineHasCode, ncloc } = finishLine(lineHasCode, ncloc));
      if (mode === "lineComment") {
        mode = "code";
      }
      continue;
    }

    if (mode === "lineComment") {
      continue;
    }

    if (mode === "blockComment") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }

    if (mode === "singleQuote" || mode === "doubleQuote") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (
        (mode === "singleQuote" && char === "'") ||
        (mode === "doubleQuote" && char === '"')
      ) {
        mode = "code";
      }
      continue;
    }

    if (mode === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "`") {
        mode = "code";
        continue;
      }
      if (char === "$" && next === "{") {
        mode = "code";
        templateExpressionDepth = 1;
        index += 1;
        if (!lineHasCode) {
          lineHasCode = true;
        }
      }
      continue;
    }

    // code mode (including template ${...} expressions)
    if (templateExpressionDepth > 0) {
      if (char === "{") {
        templateExpressionDepth += 1;
      } else if (char === "}") {
        templateExpressionDepth -= 1;
        if (templateExpressionDepth === 0) {
          mode = "template";
        }
      }
      if (!lineHasCode && !isWhitespace(char)) {
        lineHasCode = true;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      mode = "lineComment";
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      mode = "blockComment";
      index += 1;
      continue;
    }

    if (char === "'") {
      mode = "singleQuote";
      if (!lineHasCode) {
        lineHasCode = true;
      }
      continue;
    }

    if (char === '"') {
      mode = "doubleQuote";
      if (!lineHasCode) {
        lineHasCode = true;
      }
      continue;
    }

    if (char === "`") {
      mode = "template";
      if (!lineHasCode) {
        lineHasCode = true;
      }
      continue;
    }

    if (!lineHasCode && !isWhitespace(char)) {
      lineHasCode = true;
    }
  }

  ({ lineHasCode, ncloc } = finishLine(lineHasCode, ncloc));
  return ncloc;
}
