import mongoose from "mongoose";

const createMongoConnection = async (dbUrl) => {
  // Get the default connection
  try {
    const db = mongoose.connection;
    // Connect to MongoDB
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db.on("error", (error) => {
      console.error("MongoDB connection error:", error);
    });
    // Event listener for successful MongoDB connection
    db.once("open", () => {
      console.log("Connected to MongoDB");
    });
  } catch (err) {
    console.error("Error in MongoDB connection process:", err);
  }
  // Event listener for MongoDB connection error
};

export { createMongoConnection };
