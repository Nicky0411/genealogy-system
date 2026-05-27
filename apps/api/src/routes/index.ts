import { Router } from "express";
import { authRouter } from "./auth";
import { familiesRouter } from "./families";
import { genealogyRouter } from "./genealogy";
import { invitationsRouter } from "./invitations";
import { membersRouter } from "./members";

export const routes = Router();

routes.use("/auth", authRouter);
routes.use("/families", familiesRouter);
routes.use("/invitations", invitationsRouter);
routes.use("/members", membersRouter);
routes.use("/genealogy", genealogyRouter);
