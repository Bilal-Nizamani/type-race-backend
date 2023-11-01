import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import fs from "fs";
import path from "path";
import User from "../models/user.js";

// Assuming that "User" is a model in Mongoose
const currentDirectory = process.cwd();
const pathToKey = path.join(currentDirectory, "id_rsa_pub.pem");
const PUB_KEY = fs.readFileSync(pathToKey, "utf8");
// At a minimum, you must pass the `jwtFromRequest` and `secretOrKey` properties
const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: PUB_KEY,
  algorithms: ["RS256"],
};

// app.js will pass the global passport object here, and this function will configure it
const configurePassport = (passport) => {
  passport.use(
    new JwtStrategy(options, async function (jwt_payload, done) {
      try {
        const user = await User.findOne({ _id: jwt_payload.sub }).exec();
        if (user) {
          return done(null, user);
        } else {
          console.log("no-user-found");
          return done(null, false);
        }
      } catch (err) {
        return done(err, false);
      }
    })
  );
};

export default configurePassport;
