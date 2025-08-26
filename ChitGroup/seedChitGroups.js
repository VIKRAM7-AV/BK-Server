import mongoose from "mongoose";
import ChitGroup from "../Model/ChitGroup.js";
import fs from "fs";


// Load JSON data
const chitGroups = JSON.parse(fs.readFileSync("./chit_groups.json", "utf-8"));

const MONGO_URI = "mongodb+srv://vikramria195:Vikram74@bkchit.nwti8kq.mongodb.net/?retryWrites=true&w=majority&appName=BKChit";

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear old data (optional)
    await ChitGroup.deleteMany();

    // Insert new data
    await ChitGroup.insertMany(chitGroups);

    console.log("✅ Chit groups seeded successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
