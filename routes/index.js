import { Router } from "express";
import passport from "passport";
const router = Router();
import {
  userRegisterHandler,
  userLoginHandler,
  protectedRouteHandler,
} from "../handlers/authHandler.js";

router.get(
  "/protected",
  passport.authenticate("jwt", { session: false }),
  protectedRouteHandler
);
router.post("/register", userRegisterHandler);
router.post("/login", userLoginHandler);
export default router;
