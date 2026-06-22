import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const dataDir = path.join(process.cwd(), "data", "projects");

fs.mkdirSync(dataDir, { recursive: true });

router.post("/:projectId/sync", (req, res) => {
  const { projectId } = req.params;
  const { project } = req.body as { project: unknown };
  if (!project) {
    res.status(400).json({ error: "project required" });
    return;
  }
  const filePath = path.join(dataDir, `${projectId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2));
  res.json({ success: true, syncedAt: new Date().toISOString() });
});

router.get("/:projectId/sync", (req, res) => {
  const { projectId } = req.params;
  const filePath = path.join(dataDir, `${projectId}.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "No backup found for this project" });
    return;
  }
  const project = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  res.json({ project });
});

export default router;
