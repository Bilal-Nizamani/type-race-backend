import { validPassword, genPassword, issueJWT } from "../utils/authService.js";
import User from "../models/user.js";

const userRegisterHandler = (req, res, next) => {
  const saltHash = genPassword(req.body.password);

  const salt = saltHash.salt;
  const hash = saltHash.hash;

  const newUser = new User({
    username: req.body.username,
    hash: hash,
    salt: salt,
  });

  try {
    newUser.save().then((user) => {
      res.json({ success: true, user: user });
    });
  } catch (err) {
    res.json({ success: false, msg: err });
  }
};

const userLoginHandler = (req, res, next) => {
  User.findOne({ username: req.body.username })
    .then((user) => {
      if (!user) {
        return res
          .status(401)
          .json({ success: false, msg: "could not find user" });
      }

      // Function defined at bottom of app.js
      const isValid = validPassword(req.body.password, user.hash, user.salt);

      if (isValid) {
        const tokenObject = issueJWT(user);

        res.status(200).json({
          success: true,
          token: tokenObject.token,
          expiresIn: tokenObject.expires,
        });
      } else {
        res
          .status(401)
          .json({ success: false, msg: "you entered the wrong password" });
      }
    })
    .catch((err) => {
      next(err);
    });
};

const protectedRouteHandler = (req, res, next) => {
  res.status(200).json({
    success: true,
    msg: "You are successfully authenticated to this route!",
  });
};

export { userRegisterHandler, userLoginHandler, protectedRouteHandler };
