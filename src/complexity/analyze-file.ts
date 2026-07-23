import {
  Node,
  type Node as TsMorphNode,
  type SourceFile,
} from "ts-morph";
import type { FileComplexityResult } from "../types/index.js";
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

function resolveFunctionName(node: TsMorphNode): string {
  if (Node.isConstructorDeclaration(node)) {
    return "constructor";
  }
  if (Node.isMethodDeclaration(node) || Node.isFunctionDeclaration(node)) {
    return node.getName() ?? `<anonymous>:L${node.getStartLineNumber()}`;
  }
  const parent = node.getParent();
  if (Node.isVariableDeclaration(parent)) {
    return parent.getName();
  }
  return `<anonymous>:L${node.getStartLineNumber()}`;
}

export function analyzeSourceFile(
  sourceFile: SourceFile,
  filePath?: string,
): FileComplexityResult {
  const functionNodes: TsMorphNode[] = [];
  collectFunctionsInScope(sourceFile, functionNodes);

  const resolvedPath = filePath ?? sourceFile.getFilePath();
  const functions = functionNodes.map((node) => ({
    filePath: resolvedPath,
    functionName: resolveFunctionName(node),
    line: node.getStartLineNumber(),
    complexity: complexityForFunction(node),
  }));

  const cyclomaticComplexity = functions.reduce(
    (sum, fn) => sum + fn.complexity,
    0,
  );

  return {
    file: {
      filePath: resolvedPath,
      cyclomaticComplexity,
      functionCount: functions.length,
    },
    functions,
  };
}
