#!/usr/bin/env node
import { trackPathFromAfterFileEdit } from "./lib/state.mjs";
import { trackEditFromPath } from "./lib/track-path.mjs";
import { readStdinJson } from "./lib/state.mjs";
import { emptyOk } from "./lib/respond.mjs";

const input = await readStdinJson();
const relPath = trackPathFromAfterFileEdit(input.file_path);
trackEditFromPath(input, relPath);
emptyOk();
process.exit(0);
