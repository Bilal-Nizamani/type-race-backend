import mongoose from "mongoose";

// Define the schema
const userSchema = new mongoose.Schema({
  username: String,
  hash: String,
  salt: String,
});

// Create the User model using the schema
const User = mongoose.model("User", userSchema);

export default User;
