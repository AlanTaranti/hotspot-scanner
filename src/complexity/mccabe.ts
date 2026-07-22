import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type Node as TsMorphNode,
} from "ts-morph";

const LOOP_KINDS = new Set([
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
]);

const LOGICAL_OPERATOR_KINDS = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
]);

/** Count decision nodes inside a function/method body (excludes the +1 base). */
export function countDecisionNodes(root: TsMorphNode): number {
  let count = 0;

  root.forEachDescendant((node) => {
    const kind = node.getKind();

    if (kind === SyntaxKind.IfStatement) {
      count += 1;
      return;
    }

    if (LOOP_KINDS.has(kind)) {
      count += 1;
      return;
    }

    if (kind === SyntaxKind.CaseClause || kind === SyntaxKind.DefaultClause) {
      count += 1;
      return;
    }

    if (kind === SyntaxKind.CatchClause) {
      count += 1;
      return;
    }

    if (kind === SyntaxKind.ConditionalExpression) {
      count += 1;
      return;
    }

    if (kind === SyntaxKind.BinaryExpression) {
      const operatorKind = (node as BinaryExpression)
        .getOperatorToken()
        .getKind();
      if (LOGICAL_OPERATOR_KINDS.has(operatorKind)) {
        count += 1;
      }
    }
  });

  return count;
}

/** McCabe complexity for a single function: decision nodes + 1. */
export function complexityForFunction(fn: TsMorphNode): number {
  let root = fn;

  if (Node.isBodyable(fn)) {
    const body = fn.getBody();
    if (body) {
      root = body;
    }
  } else if (Node.isBodied(fn)) {
    root = fn.getBody();
  }

  return countDecisionNodes(root) + 1;
}
