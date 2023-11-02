import mongoose from "mongoose";

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
    type: raceSchema,
  },
  fullAvg: {
    type: Number,
  },
  latestRaceResults: [raceSchema],
});

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
  WPM: {
    type: Number,
    required: true,
  },
  fullAvg: {
    type: Number,
  },
  bestRace: {
    type: raceSchema,
  },
  races: {
    type: Number,
    default: 0,
  },
  WPMPercentage: {
    type: Number,
  },
  megaracer: {
    type: Number,
    default: 0,
  },
  skillLevel: {
    type: String,
  },
  expLevel: {
    type: Number,
  },
  avatar: {
    type: String,
  },
  modeStats: [modeStatsSchema],
});

const User = mongoose.model("User", userSchema);

export default User;
