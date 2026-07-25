import {
  Node,
  SyntaxKind,
  type Node as TsMorphNode,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import type { FileComplexityResult } from "../types/index.js";
import { complexityForFunction } from "./mccabe.js";

function isBodyLessNonAbstractStub(node: TsMorphNode): boolean {
  if (!Node.isFunctionDeclaration(node) && !Node.isMethodDeclaration(node)) {
    return false;
  }
  if (node.getBody()) {
    return false;
  }
  return !node.hasModifier(SyntaxKind.AbstractKeyword);
}

function unwrapCallableExpression(
  expression: TsMorphNode,
): TsMorphNode | undefined {
  if (Node.isArrowFunction(expression) || Node.isFunctionExpression(expression)) {
    return expression;
  }
  if (Node.isParenthesizedExpression(expression)) {
    return unwrapCallableExpression(expression.getExpression());
  }
  return undefined;
}

function collectCallableNode(
  node: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  if (!Node.isArrowFunction(node) && !Node.isFunctionExpression(node)) {
    return;
  }
  if (collected.has(node)) {
    return;
  }
  collected.add(node);
  functions.push(node);
  const body = node.getBody();
  if (body) {
    collectFunctionsInScope(body, functions, collected);
  }
}

function collectFromCallExpression(
  call: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  if (!Node.isCallExpression(call)) {
    return;
  }
  const iifeCallable = unwrapCallableExpression(call.getExpression());
  if (iifeCallable) {
    collectCallableNode(iifeCallable, functions, collected);
  }
  for (const arg of call.getArguments()) {
    collectCallableNode(arg, functions, collected);
  }
}

function pushCallableMember(
  member: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  if (isBodyLessNonAbstractStub(member)) {
    return;
  }
  if (collected.has(member)) {
    return;
  }
  collected.add(member);
  functions.push(member);
  const body =
    Node.isMethodDeclaration(member) ||
    Node.isConstructorDeclaration(member) ||
    Node.isGetAccessorDeclaration(member) ||
    Node.isSetAccessorDeclaration(member) ||
    Node.isFunctionDeclaration(member)
      ? member.getBody()
      : undefined;
  if (body) {
    collectFunctionsInScope(body, functions, collected);
  }
}

function collectClassLikeMembers(
  classLike: { getMembers(): TsMorphNode[] },
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  for (const member of classLike.getMembers()) {
    if (
      Node.isMethodDeclaration(member) ||
      Node.isConstructorDeclaration(member) ||
      Node.isGetAccessorDeclaration(member) ||
      Node.isSetAccessorDeclaration(member)
    ) {
      pushCallableMember(member, functions, collected);
      continue;
    }

    if (Node.isPropertyDeclaration(member)) {
      const initializer = member.getInitializer();
      if (initializer) {
        collectCallableInitializer(initializer, functions, collected);
      }
    }
  }
}

function collectCallableInitializer(
  initializer: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  if (
    Node.isArrowFunction(initializer) ||
    Node.isFunctionExpression(initializer)
  ) {
    collectCallableNode(initializer, functions, collected);
    return;
  }

  if (Node.isCallExpression(initializer)) {
    collectFromCallExpression(initializer, functions, collected);
    return;
  }

  if (Node.isClassExpression(initializer)) {
    collectClassLikeMembers(initializer, functions, collected);
    return;
  }

  if (Node.isObjectLiteralExpression(initializer)) {
    collectFromObjectLiteral(initializer, functions, collected);
  }
}

function collectFromObjectLiteral(
  objectLiteral: ObjectLiteralExpression,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  for (const property of objectLiteral.getProperties()) {
    if (Node.isMethodDeclaration(property)) {
      pushCallableMember(property, functions, collected);
      continue;
    }

    if (
      Node.isGetAccessorDeclaration(property) ||
      Node.isSetAccessorDeclaration(property)
    ) {
      pushCallableMember(property, functions, collected);
      continue;
    }

    if (Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializer();
      if (initializer) {
        collectCallableInitializer(initializer, functions, collected);
      }
      continue;
    }
  }
}

function collectAssignmentRhsCallable(
  binaryExpression: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): boolean {
  if (!Node.isBinaryExpression(binaryExpression)) {
    return false;
  }
  if (
    binaryExpression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken
  ) {
    return false;
  }
  const rhs = binaryExpression.getRight();
  if (Node.isArrowFunction(rhs) || Node.isFunctionExpression(rhs)) {
    collectCallableNode(rhs, functions, collected);
    return true;
  }
  if (Node.isCallExpression(rhs)) {
    collectFromCallExpression(rhs, functions, collected);
    return true;
  }
  return false;
}

function collectFunctionsInScope(
  scope: TsMorphNode,
  functions: TsMorphNode[],
  collected: Set<TsMorphNode>,
): void {
  scope.forEachChild((child) => {
    if (
      Node.isFunctionDeclaration(child) ||
      Node.isMethodDeclaration(child) ||
      Node.isConstructorDeclaration(child)
    ) {
      pushCallableMember(child, functions, collected);
      return;
    }

    if (Node.isVariableStatement(child)) {
      for (const declaration of child.getDeclarations()) {
        const initializer = declaration.getInitializer();
        if (initializer) {
          collectCallableInitializer(initializer, functions, collected);
        }
      }
      return;
    }

    if (Node.isClassDeclaration(child)) {
      collectClassLikeMembers(child, functions, collected);
      return;
    }

    if (Node.isObjectLiteralExpression(child)) {
      collectFromObjectLiteral(child, functions, collected);
      return;
    }

    if (Node.isCallExpression(child)) {
      collectFromCallExpression(child, functions, collected);
      collectFunctionsInScope(child, functions, collected);
      return;
    }

    if (
      Node.isBinaryExpression(child) &&
      collectAssignmentRhsCallable(child, functions, collected)
    ) {
      return;
    }

    collectFunctionsInScope(child, functions, collected);
  });
}

function resolveAssignmentLhsName(
  lhs: TsMorphNode,
  fallbackLine: number,
): string {
  if (Node.isIdentifier(lhs)) {
    return lhs.getText();
  }
  if (Node.isPropertyAccessExpression(lhs)) {
    return lhs.getName();
  }
  return `<anonymous>:L${fallbackLine}`;
}

function resolveFunctionName(node: TsMorphNode): string {
  if (Node.isConstructorDeclaration(node)) {
    return "constructor";
  }
  if (Node.isMethodDeclaration(node) || Node.isFunctionDeclaration(node)) {
    return node.getName() ?? `<anonymous>:L${node.getStartLineNumber()}`;
  }
  if (
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  ) {
    return node.getName();
  }
  const parent = node.getParent();
  if (Node.isVariableDeclaration(parent)) {
    return parent.getName();
  }
  if (Node.isPropertyDeclaration(parent)) {
    return parent.getName();
  }
  if (Node.isPropertyAssignment(parent)) {
    return parent.getName() ?? `<anonymous>:L${node.getStartLineNumber()}`;
  }
  if (Node.isBinaryExpression(parent)) {
    if (parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
      return resolveAssignmentLhsName(parent.getLeft(), node.getStartLineNumber());
    }
  }
  return `<anonymous>:L${node.getStartLineNumber()}`;
}

export function analyzeSourceFile(
  sourceFile: SourceFile,
  filePath?: string,
): FileComplexityResult {
  const functionNodes: TsMorphNode[] = [];
  const collected = new Set<TsMorphNode>();
  collectFunctionsInScope(sourceFile, functionNodes, collected);

  const resolvedPath = filePath ?? sourceFile.getFilePath();
  const functions = functionNodes.map((node) => ({
    filePath: resolvedPath,
    functionName: resolveFunctionName(node),
    line: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
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
