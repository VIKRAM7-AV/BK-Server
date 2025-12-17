import mongoose from "mongoose";
import XLSX from "xlsx";

import Agent from "../Model/AgentModal.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import User from "../Model/UserModel.js";
import ChitGroup from "../Model/ChitGroup.js";
import { BookedChit, Auction } from "../Model/BookedChit.js";

/* ================= CONFIG ================= */
const MONGO_URI =
  "mongodb+srv://bkchitspvtltd_db_user:seoHqyUhOM6BDGVn@cluster0.wtr5c7y.mongodb.net/bkchit?retryWrites=true&w=majority&appName=BKChit";

// 👉 Excel file location (CONFIRM THIS)
const EXCEL_PATH = "./Book1.xlsx";

/* ================= HELPERS ================= */
const parseDate = (value) => {
  if (!value) return null;

  // 1️⃣ Already JS Date (BEST CASE)
  if (value instanceof Date && !isNaN(value)) {
    return value;
  }

  // 2️⃣ Excel serial number → real date
  if (typeof value === "number") {
    const excelStartDate = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelStartDate.getTime() + value * 86400000);
  }

  // 3️⃣ String date (dd-mm-yyyy)
  if (typeof value === "string") {
    const clean = value.trim();

    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
      const [dd, mm, yyyy] = clean.split("-");
      return new Date(`${yyyy}-${mm}-${dd}`);
    }

    // yyyy-mm-dd or ISO
    const parsed = new Date(clean);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
};


const randomPhone = () =>
  9000000000 + Math.floor(Math.random() * 999999999);

const dummyLocation = {
  type: "Point",
  coordinates: [78.1363855, 11.6760413], // lng, lat
};

/* ================= MAIN ================= */
const seedExcelData = async () => {
  try {
    /* ===== CONNECT ===== */
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected");

    /* ===== CLEAN BROKEN ROUTES ===== */
    await WorkerRoute.deleteMany({ routeId: null });

    /* ===== READ EXCEL ===== */
    console.log("📂 Reading Excel:", EXCEL_PATH);

    const workbook = XLSX.readFile(EXCEL_PATH);
    console.log("📄 Sheets found:", workbook.SheetNames);

    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: "" }
    );

    console.log("📊 Total rows found:", rows.length);
    if (rows.length === 0) {
      console.log("❌ Excel empty – stopping");
      process.exit(1);
    }

    console.log("🧾 First row keys:", Object.keys(rows[0]));

    /* ===== STEP 1: AGENTS ===== */
    const agentMap = {};

    for (const row of rows) {
      const agentName =
        row["Agnt.Name"] ||
        row["Agent Name"] ||
        row["Agent"];

      if (!agentName) continue;

      if (!agentMap[agentName]) {
        let agent = await Agent.findOne({ name: agentName });

        if (!agent) {
          agent = await Agent.create({
            name: agentName,
            phone: randomPhone(),
          });
          console.log("👤 Agent created:", agentName);
        }

        agentMap[agentName] = agent;
      }
    }

    /* ===== STEP 2: ROUTES ===== */
    let route1 = await WorkerRoute.findOne({ place: "Route_1" });
    if (!route1) route1 = await WorkerRoute.create({ place: "Route_1" });

    let route2 = await WorkerRoute.findOne({ place: "Route_2" });
    if (!route2) route2 = await WorkerRoute.create({ place: "Route_2" });

    const routes = [route1, route2];
    let routeIndex = 0;

    /* ===== STEP 3 & 4: USER + BOOKING ===== */
    let processed = 0;

    for (const row of rows) {
      const userName = row["Names"] || row["Name"];
      const phone = row["PH.No"] || row["Phone"];
      const agentName =
        row["Agnt.Name"] || row["Agent Name"];

      const bookingType = String(
        row["book Type"] || row["Book Type"]
      ).toLowerCase();

      if (!userName || !phone || !agentName) continue;

      /* ---- USER ---- */
      let user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({
          name: userName,
          phone,
          agent: agentMap[agentName]._id,
          route: routes[routeIndex % 2]._id,
          location: dummyLocation,
        });
        routeIndex++;
      }

      /* ---- GROUP ---- */
      const groupNo = row["Group No"] || row["Group"];
      if (!groupNo) continue;

      const baseGroupCode = groupNo.split("/")[0];

      const chitGroup = await ChitGroup.findOne({
        groupCode: baseGroupCode,
      });
      if (!chitGroup) {
        console.log("⚠️ ChitGroup not found:", baseGroupCode);
        continue;
      }

      const members = groupNo
        .split("/")
        .pop()
        .split(",");

      for (const m of members) {
        const groupUserId = `${baseGroupCode}/001/${m.trim()}`;

        const exists = await BookedChit.findOne({
          GroupUserId: groupUserId,
        });
        if (exists) continue;

        const auction = await Auction.create({
          userId: user._id,
          chitId: chitGroup._id,
          payment: 0
        });

        const bookedChit = await BookedChit.create({
          userId: user._id,
          chitId: chitGroup._id,
          GroupUserId: groupUserId,
          bookingType,
          collectedAmount: row["T.Colle.."] || 0,
          pendingAmount: row["B.Amount"] || 0,
          monthlyAmount: chitGroup.monthlyContribution,
          dailyAmount: chitGroup.dailyContribution,
          month: parseDate(row["CD"]),
          lastDate: parseDate(row["TD"]),
          auction: auction._id,
          createdAt: parseDate(row["CD"]),
        });

        user.chits.push(bookedChit._id);
        user.auction.push(auction._id);

        if (bookingType === "daily") {
          await WorkerRoute.findByIdAndUpdate(user.route, {
            $push: { DailyChit: bookedChit._id },
          });
        } else {
          await Agent.findByIdAndUpdate(user.agent, {
            $push: { monthlyUsers: bookedChit._id },
          });
        }

        await user.save();
      }

      processed++;
      if (processed % 5 === 0) {
        console.log(`✅ Processed ${processed} rows`);
      }
    }

    /* ===== FINAL COUNTS ===== */
    console.log("🎉 SEED COMPLETED");
    console.log("Agents:", await Agent.countDocuments());
    console.log("Routes:", await WorkerRoute.countDocuments());
    console.log("Users:", await User.countDocuments());
    console.log("BookedChits:", await BookedChit.countDocuments());
    console.log("Auctions:", await Auction.countDocuments());

    process.exit(0);
  } catch (err) {
    console.error("❌ SEED FAILED:", err);
    process.exit(1);
  }
};

seedExcelData();
