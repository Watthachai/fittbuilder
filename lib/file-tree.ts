import type { ProjectFiles } from "./types";

/**
 * A node in the file explorer tree, derived on the fly from FITT's flat
 * `ProjectFiles` (Record<path, contents>). The flat map stays the single source
 * of truth — the tree is purely a view, so generation/streaming/storage are
 * untouched.
 */
export interface TreeNode {
  name: string;
  /** Full path for files; the folder path for folders. */
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

/** Build a sorted (folders first, then files; alphabetical) tree from flat paths. */
export function buildFileTree(files: ProjectFiles | null): TreeNode[] {
  const root: TreeNode[] = [];
  if (!files) return root;
  const folders = new Map<string, TreeNode>();

  for (const filePath of Object.keys(files)) {
    const parts = filePath.split("/").filter(Boolean);
    let siblings = root;
    let prefix = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      prefix = prefix ? `${prefix}/${part}` : part;
      if (i === parts.length - 1) {
        siblings.push({ name: part, path: filePath, type: "file" });
      } else {
        let folder = folders.get(prefix);
        if (!folder) {
          folder = { name: part, path: prefix, type: "folder", children: [] };
          folders.set(prefix, folder);
          siblings.push(folder);
        }
        siblings = folder.children!;
      }
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.type !== b.type ? (a.type === "folder" ? -1 : 1) : a.name.localeCompare(b.name)
    );
    for (const node of nodes) if (node.children) sort(node.children);
  };
  sort(root);
  return root;
}
