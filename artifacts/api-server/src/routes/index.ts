import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);

export default router;
