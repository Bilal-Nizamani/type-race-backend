import mongoose from "mongoose";

// Define the schema for race data
const raceSchema = new mongoose.Schema({
  speed: {
    type: Number,
    required: true,
  },
  accuracy: {
    type: Number,
    required: true,
  },
  points: {
    type: Number,
    required: true,
  },
  place: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

// Define the schema for mode statistics
const modeStatsSchema = new mongoose.Schema({
  mode: {
    type: String,
    required: true,
  },
  races: {
    type: Number,
    required: true,
  },
  bestRace: {
    type: Number,
    required: true,
  },
  fullAvg: {
    type: Number,
    required: true,
  },
  latestRaceResults: [raceSchema],
});

// Define the main user schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  hash: {
    type: String,
    required: true,
  },
  salt: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  WPM: {
    type: Number,
    defautl: 0,
  },
  fullAvg: {
    type: Number,
    default: 0,
  },
  premium: { type: Boolean, default: false },
  bestRace: {
    type: Number,
    defuatl: 0,
  },
  races: {
    type: Number,
    default: 0,
  },

  skillLevel: {
    type: String,
    defualt: "Noobie",
  },
  expLevel: {
    type: Number,
    default: 1,
  },
  lastFifteenGamesWpmAvrg: {
    type: Number,
    defulat: 0,
  },
  awards: {
    type: [String], // Assuming awards are represented as strings
    defautl: [],
  },
  avatars: {
    type: [String],
    default: ["ferari"],
  },
  modeStats: [modeStatsSchema],
});

const User = mongoose.model("User", userSchema);

export default User;
