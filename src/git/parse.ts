export interface ParsedFileChange {
  path: string;
  additions: number | null;
  deletions: number | null;
  renameFrom?: string;
}

export interface ParsedCommit {
  hash: string;
  date: Date;
  author: string;
  files: ParsedFileChange[];
}

const COMMIT_HEADER_RE = /^COMMIT\|([0-9a-f]+)\|(.+)\|(.+)$/;
const RENAME_LINE_RE = /^(.+) => (.+)$/;
/** git log -M --numstat embeds renames as `dir/{old => new}` in the path column */
const NUMSTAT_EMBEDDED_RENAME_RE = /^(.*)\{([^/}]+) => ([^/}]+)\}$/;

function parseNumstatLine(line: string): ParsedFileChange | null {
  const tab1 = line.indexOf("\t");
  if (tab1 === -1) {
    return null;
  }
  const tab2 = line.indexOf("\t", tab1 + 1);
  if (tab2 === -1) {
    return null;
  }

  const additionsRaw = line.slice(0, tab1);
  const deletionsRaw = line.slice(tab1 + 1, tab2);
  const path = line.slice(tab2 + 1);

  const additions = additionsRaw === "-" ? null : Number(additionsRaw);
  const deletions = deletionsRaw === "-" ? null : Number(deletionsRaw);

  const embeddedRename = NUMSTAT_EMBEDDED_RENAME_RE.exec(path);
  if (embeddedRename) {
    const prefix = embeddedRename[1]!;
    const fromName = embeddedRename[2]!;
    const toName = embeddedRename[3]!;
    return {
      path: `${prefix}${toName}`,
      additions,
      deletions,
      renameFrom: `${prefix}${fromName}`,
    };
  }

  return { path, additions, deletions };
}

export async function* parseGitLogStream(
  lines: AsyncIterable<string>,
): AsyncGenerator<ParsedCommit> {
  let current: ParsedCommit | null = null;
  let pendingRenameFrom: string | undefined;
  let pendingRenameTo: string | undefined;

  const flushPendingRename = (): void => {
    if (current === null || pendingRenameFrom === undefined) {
      return;
    }
    current.files.push({
      path: pendingRenameTo ?? pendingRenameFrom,
      additions: null,
      deletions: null,
      renameFrom: pendingRenameFrom,
    });
    pendingRenameFrom = undefined;
    pendingRenameTo = undefined;
  };

  const yieldCurrent = (): ParsedCommit | null => {
    if (current === null) {
      return null;
    }
    flushPendingRename();
    if (current.files.length === 0) {
      current = null;
      return null;
    }
    const commit = current;
    current = null;
    pendingRenameFrom = undefined;
    pendingRenameTo = undefined;
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
      pendingRenameFrom = undefined;
      pendingRenameTo = undefined;
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

    const numstat = parseNumstatLine(line);
    if (numstat) {
      if (pendingRenameFrom !== undefined) {
        numstat.renameFrom = pendingRenameFrom;
        if (pendingRenameTo !== undefined && numstat.path !== pendingRenameTo) {
          numstat.path = pendingRenameTo;
        }
        pendingRenameFrom = undefined;
        pendingRenameTo = undefined;
      }
      current.files.push(numstat);
      continue;
    }

    const renameMatch = RENAME_LINE_RE.exec(line);
    if (renameMatch) {
      flushPendingRename();
      pendingRenameFrom = renameMatch[1]!.trim();
      pendingRenameTo = renameMatch[2]!.trim();
      continue;
    }
  }

  const yielded = yieldCurrent();
  if (yielded) {
    yield yielded;
  }
}
