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
  // The JWT payload is passed into the verify callback
  passport.use(
    new JwtStrategy(options, (jwt_payload, done) => {
      console.log(jwt_payload);

      // We will assign the `sub` property on the JWT to the database ID of user
      User.findOne({ _id: jwt_payload.sub }, (err, user) => {
        // This flow looks familiar? It is the same as when we implemented
        // the `passport-local` strategy
        if (err) {
          return done(err, false);
        }
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      });
    })
  );
};

export default configurePassport;
