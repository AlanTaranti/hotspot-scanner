import { spawn } from "node:child_process";

export type SinceProbeResult =
  | { status: "ok"; tipSubject?: string }
  | { status: "empty" }
  | { status: "invalid"; message: string };

export interface ProbeSinceWindowOptions {
  repoPath: string;
  since: string;
}

export function buildGitProbeSinceArgv(
  repoPath: string,
  since: string,
): string[] {
  return ["-C", repoPath, "log", "-1", `--since=${since}`, "--format=%s"];
}

export async function probeSinceWindow(
  options: ProbeSinceWindowOptions,
): Promise<SinceProbeResult> {
  const args = buildGitProbeSinceArgv(options.repoPath, options.since);

  return new Promise((resolve) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err) => {
      resolve({
        status: "invalid",
        message: err.message,
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = stderrChunks.join("").trim();
        resolve({
          status: "invalid",
          message: stderr || "unknown error",
        });
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString().trim();
      if (stdout.length === 0) {
        resolve({ status: "empty" });
        return;
      }

      resolve({ status: "ok", tipSubject: stdout });
    });
  });
}
