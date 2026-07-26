#!/usr/bin/env node
import { emptyOk } from "./lib/respond.mjs";
import {
  getWorkspaceRoot,
  readStdinJson,
  trackPathFromAfterFileEdit,
} from "./lib/state.mjs";
import { trackEditFromPath } from "./lib/track-path.mjs";

const input = await readStdinJson();
const workspaceRoot = getWorkspaceRoot(input);
const relPath = trackPathFromAfterFileEdit(input.file_path, workspaceRoot);
trackEditFromPath(input, relPath);
emptyOk();
process.exit(0);
