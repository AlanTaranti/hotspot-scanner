import {
  Node,
  type Node as TsMorphNode,
  type SourceFile,
} from "ts-morph";
import type { ComplexityResult } from "../types/index.js";
import { complexityForFunction } from "./mccabe.js";

function collectFunctionsInScope(
  scope: TsMorphNode,
  functions: TsMorphNode[],
): void {
  scope.forEachChild((child) => {
    if (
      Node.isFunctionDeclaration(child) ||
      Node.isMethodDeclaration(child) ||
      Node.isConstructorDeclaration(child)
    ) {
      functions.push(child);
      const body = child.getBody();
      if (body) {
        collectFunctionsInScope(body, functions);
      }
      return;
    }

    if (Node.isVariableStatement(child)) {
      for (const declaration of child.getDeclarations()) {
        const initializer = declaration.getInitializer();
        if (
          initializer &&
          (Node.isArrowFunction(initializer) ||
            Node.isFunctionExpression(initializer))
        ) {
          functions.push(initializer);
          const body = initializer.getBody();
          if (body) {
            collectFunctionsInScope(body, functions);
          }
        }
      }
      return;
    }

    if (Node.isClassDeclaration(child)) {
      for (const member of child.getMembers()) {
        if (
          Node.isMethodDeclaration(member) ||
          Node.isConstructorDeclaration(member)
        ) {
          functions.push(member);
          const body = member.getBody();
          if (body) {
            collectFunctionsInScope(body, functions);
          }
        }
      }
      return;
    }

    collectFunctionsInScope(child, functions);
  });
}

export function analyzeSourceFile(
  sourceFile: SourceFile,
  filePath?: string,
): ComplexityResult {
  const functions: TsMorphNode[] = [];
  collectFunctionsInScope(sourceFile, functions);

  const cyclomaticComplexity = functions.reduce(
    (sum, fn) => sum + complexityForFunction(fn),
    0,
  );

  return {
    filePath: filePath ?? sourceFile.getFilePath(),
    cyclomaticComplexity,
    functionCount: functions.length,
  };
}
