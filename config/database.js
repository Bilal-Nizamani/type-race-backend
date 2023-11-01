import mongoose from "mongoose";

const createMongoConnection = async (dbUrl) => {
  mongoose.connection.on("error", (err) => {
    console.error(`Mongoose connection error: ${err}`);
    process.exit(1);
  });

  mongoose.connection.once("open", () => {
    console.log(`Connected to MongoDB`);
  });

  try {
    // Connect to MongoDB
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (err) {
    console.error(`Error in MongoDB connection process: ${err}`);
  }
};

export { createMongoConnection };
