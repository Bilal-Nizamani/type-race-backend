import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const { model: UserModel } = mongoose;

// Assuming that "User" is a model in Mongoose
const User = UserModel("User");
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
  console.log("checking");

  // The JWT payload is passed into the verify callback
  const Strategy = new JwtStrategy(options, async (jwt_payload, done) => {
    try {
      const user = await User.findOne({ _id: jwt_payload.sub });
      if (user) {
        console.log("got user");
        return done(null, user);
      } else {
        console.log("no user");
        return done(null, false);
      }
    } catch (err) {
      console.log("ererere");
      return done(err, false);
    }
  });
  passport.use(Strategy);
};

export default configurePassport;
