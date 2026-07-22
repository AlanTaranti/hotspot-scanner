export class PathAliasMap {
  private readonly parent = new Map<string, string>();
  private readonly ambiguous = new Set<string>();

  link(oldPath: string, newPath: string): void {
    if (oldPath === newPath) {
      return;
    }

    const oldCanonical = this.canonical(oldPath);
    const newCanonical = this.canonical(newPath);

    if (oldCanonical === newCanonical) {
      if (oldPath !== newPath) {
        this.ambiguous.add(oldPath);
        this.ambiguous.add(newPath);
      }
      return;
    }

    if (this.wouldCreateCycle(oldCanonical, newCanonical)) {
      this.ambiguous.add(oldCanonical);
      this.ambiguous.add(newCanonical);
    }

    this.parent.set(oldCanonical, newCanonical);
  }

  private wouldCreateCycle(from: string, to: string): boolean {
    let current = to;
    const visited = new Set<string>();

    while (this.parent.has(current)) {
      if (current === from || visited.has(current)) {
        return true;
      }
      visited.add(current);
      current = this.parent.get(current)!;
    }

    return current === from;
  }

  canonical(path: string): string {
    let current = path;
    const visited = new Set<string>();

    while (this.parent.has(current)) {
      if (visited.has(current)) {
        this.ambiguous.add(path);
        return current;
      }
      visited.add(current);
      current = this.parent.get(current)!;
    }

    return current;
  }

  getAmbiguousPaths(): string[] {
    return [...this.ambiguous].sort();
  }
}
