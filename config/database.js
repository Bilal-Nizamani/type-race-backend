import mongoose from "mongoose";

const mongoURI =
  "mongodb://bilal_nizamani:03330369169@localhost:27017/?authMechanism=DEFAULT";

const createMongoConnection = async () => {
  console.log("Starting MongoDB connection");

  // Get the default connection
  const db = mongoose.connection;

  // Event listener for MongoDB connection error
  db.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });

  // Event listener for successful MongoDB connection
  db.once("open", () => {
    console.log("Connected to MongoDB");

    // Define a schema and mode
    // Create and save a document
  });

  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (err) {
    console.error("Error in MongoDB connection process:", err);
  }
};

export { createMongoConnection };
