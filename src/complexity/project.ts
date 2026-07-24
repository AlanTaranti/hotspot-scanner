import { join } from "node:path";
import { Project, type SourceFile } from "ts-morph";

export const DEFAULT_BATCH_SIZE = 50;

export interface TsMorphProjectOptions {
  repoPath: string;
}

export interface ParseFailure {
  filePath: string;
  message: string;
}

export interface TsMorphProjectAdapter {
  loadBatch(paths: string[]): Promise<SourceFile[]>;
  getParseFailures(): ParseFailure[];
}

export function createTsMorphProject(
  options: TsMorphProjectOptions,
): TsMorphProjectAdapter {
  let parseFailures: ParseFailure[] = [];
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });

  function clearSourceFiles(): void {
    for (const sourceFile of project.getSourceFiles()) {
      project.removeSourceFile(sourceFile);
    }
  }

  return {
    async loadBatch(paths: string[]): Promise<SourceFile[]> {
      parseFailures = [];
      clearSourceFiles();

      const sourceFiles: SourceFile[] = [];

      for (const relativePath of paths) {
        const absolutePath = join(options.repoPath, relativePath);
        let sourceFile: SourceFile;
        try {
          sourceFile = project.addSourceFileAtPath(absolutePath);
        } catch (error) {
          parseFailures.push({
            filePath: relativePath,
            message: error instanceof Error ? error.message : String(error),
          });
          continue;
        }

        const diagnostics = project
          .getProgram()
          .getSyntacticDiagnostics(sourceFile);

        if (diagnostics.length > 0) {
          const message = diagnostics
            .map((diagnostic) => diagnostic.getMessageText())
            .join("; ");
          parseFailures.push({ filePath: relativePath, message });
          continue;
        }

        sourceFiles.push(sourceFile);
      }

      return sourceFiles;
    },

    getParseFailures(): ParseFailure[] {
      return parseFailures;
    },
  };
}
