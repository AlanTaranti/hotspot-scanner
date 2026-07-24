export interface ParsedPatchHunk {
  newLinesTouched: Set<number>;
  linesChanged: number;
}

export interface ParsedPatchFile {
  path: string;
  renameFrom?: string;
  hunks: ParsedPatchHunk[];
}

export interface ParsedPatchCommit {
  hash: string;
  date: Date;
  author: string;
  files: ParsedPatchFile[];
}

const COMMIT_HEADER_RE = /^COMMIT\|([0-9a-f]+)\|(.+)\|(.+)$/;
const DIFF_GIT_RE = /^diff --git a\/(.+) b\/(.+)$/;
const RENAME_LINE_RE = /^(.+) => (.+)$/;
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseHunkHeader(line: string): {
  oldStart: number;
  newStart: number;
} | null {
  const match = HUNK_HEADER_RE.exec(line);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number(match[1]),
    newStart: Number(match[3]),
  };
}

function finalizeHunk(
  oldStart: number,
  newStart: number,
  bodyLines: string[],
): ParsedPatchHunk {
  let _oldLine = oldStart;
  let newLine = newStart;
  const newLinesTouched = new Set<number>();
  let linesChanged = 0;

  for (const bodyLine of bodyLines) {
    if (bodyLine.length === 0) {
      continue;
    }
    const prefix = bodyLine[0];
    const content = bodyLine.slice(1);

    if (prefix === " " && content.length >= 0) {
      newLinesTouched.add(newLine);
      _oldLine += 1;
      newLine += 1;
      continue;
    }

    if (prefix === "-") {
      linesChanged += 1;
      _oldLine += 1;
      continue;
    }

    if (prefix === "+") {
      linesChanged += 1;
      newLinesTouched.add(newLine);
      newLine += 1;
    }
  }

  if (newLinesTouched.size === 0 && linesChanged > 0) {
    newLinesTouched.add(newStart);
  }

  return { newLinesTouched, linesChanged };
}

export async function* parsePatchLogStream(
  lines: AsyncIterable<string>,
): AsyncGenerator<ParsedPatchCommit> {
  let current: ParsedPatchCommit | null = null;
  let currentFile: ParsedPatchFile | null = null;
  let pendingRenameFrom: string | undefined;
  let pendingRenameTo: string | undefined;
  let hunkHeader: { oldStart: number; newStart: number } | null = null;
  let hunkBody: string[] = [];

  const flushHunk = (): void => {
    if (currentFile === null || hunkHeader === null) {
      hunkHeader = null;
      hunkBody = [];
      return;
    }
    currentFile.hunks.push(
      finalizeHunk(hunkHeader.oldStart, hunkHeader.newStart, hunkBody),
    );
    hunkHeader = null;
    hunkBody = [];
  };

  const flushFile = (): void => {
    flushHunk();
    if (current === null || currentFile === null) {
      currentFile = null;
      pendingRenameFrom = undefined;
      pendingRenameTo = undefined;
      return;
    }
    if (pendingRenameFrom !== undefined) {
      currentFile.renameFrom = pendingRenameFrom;
      if (pendingRenameTo !== undefined) {
        currentFile.path = pendingRenameTo;
      }
    }
    if (currentFile.hunks.length > 0 || currentFile.renameFrom !== undefined) {
      current.files.push(currentFile);
    }
    currentFile = null;
    pendingRenameFrom = undefined;
    pendingRenameTo = undefined;
  };

  const yieldCurrent = (): ParsedPatchCommit | null => {
    flushFile();
    if (current === null || current.files.length === 0) {
      current = null;
      return null;
    }
    const commit = current;
    current = null;
    return commit;
  };

  for await (const line of lines) {
    const commitMatch = COMMIT_HEADER_RE.exec(line);
    if (commitMatch) {
      const yielded = yieldCurrent();
      if (yielded) {
        yield yielded;
      }

      current = {
        hash: commitMatch[1]!,
        date: new Date(commitMatch[2]!),
        author: commitMatch[3]!,
        files: [],
      };
      continue;
    }

    if (current === null) {
      continue;
    }

    if (line === "") {
      const yielded = yieldCurrent();
      if (yielded) {
        yield yielded;
      }
      continue;
    }

    const diffMatch = DIFF_GIT_RE.exec(line);
    if (diffMatch) {
      flushFile();
      currentFile = {
        path: diffMatch[2]!,
        hunks: [],
      };
      pendingRenameFrom = undefined;
      pendingRenameTo = undefined;
      continue;
    }

    const renameMatch = RENAME_LINE_RE.exec(line);
    if (renameMatch && !line.startsWith("diff --git")) {
      flushFile();
      pendingRenameFrom = renameMatch[1]!.trim();
      pendingRenameTo = renameMatch[2]!.trim();
      currentFile = {
        path: pendingRenameTo,
        hunks: [],
      };
      continue;
    }

    const hunkMatch = parseHunkHeader(line);
    if (hunkMatch) {
      flushHunk();
      hunkHeader = hunkMatch;
      continue;
    }

    if (hunkHeader !== null) {
      hunkBody.push(line);
    }
  }

  const final = yieldCurrent();
  if (final) {
    yield final;
  }
}

export function hunkIntersectsFunction(
  hunk: ParsedPatchHunk,
  fnStart: number,
  fnEnd: number,
): boolean {
  for (const line of hunk.newLinesTouched) {
    if (line >= fnStart && line <= fnEnd) {
      return true;
    }
  }
  return false;
}
