import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const dataDir = path.resolve(process.cwd(), "data", "projects");

fs.mkdirSync(dataDir, { recursive: true });

const VALID_PROJECT_ID = /^[a-z0-9_-]{1,64}$/i;

function validateProjectId(projectId: string): boolean {
  return VALID_PROJECT_ID.test(projectId);
}

function safeFilePath(projectId: string): string | null {
  if (!validateProjectId(projectId)) return null;
  const resolved = path.resolve(dataDir, `${projectId}.json`);
  if (!resolved.startsWith(dataDir + path.sep)) return null;
  return resolved;
}

router.post("/:projectId/sync", (req, res) => {
  const { projectId } = req.params;
  const filePath = safeFilePath(projectId);
  if (!filePath) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }
  const { project } = req.body as { project: unknown };
  if (!project) {
    res.status(400).json({ error: "project required" });
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2));
  res.json({ success: true, syncedAt: new Date().toISOString() });
});

router.get("/:projectId/sync", (req, res) => {
  const { projectId } = req.params;
  const filePath = safeFilePath(projectId);
  if (!filePath) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "No backup found for this project" });
    return;
  }
  const project = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  res.json({ project });
});

export default router;
