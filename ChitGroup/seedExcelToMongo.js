import mongoose from "mongoose";
import fs from "fs";

import Agent from "../Model/AgentModal.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import User from "../Model/UserModel.js";
import ChitGroup from "../Model/ChitGroup.js";
import { BookedChit, Auction } from "../Model/BookedChit.js";

const MONGO_URI = "YOUR_MONGO_URI";

// helpers
const toNumber = (v) => Number(String(v).replace(/,/g, ""));
const parseDate = (d) => {
  const [dd, mm, yyyy] = d.split("-");
  return new Date(`${yyyy}-${mm}-${dd}`);
};

// detect booking type from header
const detectBookingType = (meta) =>
  meta.toLowerCase().includes("daily") ? "daily" : "monthly";

const seedExcel = async () => {
  await mongoose.connect(MONGO_URI);

  const excel = JSON.parse(fs.readFileSync("./excel.json", "utf8"));
  const bookingType = detectBookingType(excel.meta);

  /* ---------------- STEP 1: AGENTS ---------------- */
  const agentMap = {};
  for (const row of excel.rows) {
    if (!agentMap[row["Agnt.Name"]]) {
      const agent =
        (await Agent.findOne({ name: row["Agnt.Name"] })) ||
        (await Agent.create({ name: row["Agnt.Name"] }));
      agentMap[row["Agnt.Name"]] = agent;
    }
  }

  /* ---------------- STEP 2: ROUTES ---------------- */
  const routes = await WorkerRoute.find();
  const route1 =
    routes[0] || (await WorkerRoute.create({ place: "Route_1" }));
  const route2 =
    routes[1] || (await WorkerRoute.create({ place: "Route_2" }));
  let routeToggle = true;

  /* ---------------- STEP 3: USERS ---------------- */
  const userMap = {};
  for (const row of excel.rows) {
    if (!userMap[row["PH.No"]]) {
      const agent = agentMap[row["Agnt.Name"]];
      const route = routeToggle ? route1 : route2;
      routeToggle = !routeToggle;

      const user =
        (await User.findOne({ phone: row["PH.No"] })) ||
        (await User.create({
          name: row["Names"],
          phone: row["PH.No"],
          agent: agent._id,
          route: route._id,
        }));

      userMap[row["PH.No"]] = user;
    }
  }

  /* ---------------- STEP 4: BOOKED CHITS ---------------- */
  for (const row of excel.rows) {
    const user = userMap[row["PH.No"]];
    const agent = agentMap[row["Agnt.Name"]];

    const groupRaw = row["Group No"]; // BK2A/001/46,47
    const [groupCode, , members] = groupRaw.split("/");
    const chitGroup = await ChitGroup.findOne({ groupCode });

    if (!chitGroup) continue;

    const memberNos = members.split(",");

    for (const no of memberNos) {
      const groupUserId = `${groupCode}/001/${no}`;

      const auction = await Auction.create({
        userId: user._id,
        chitId: chitGroup._id,
        payment: 0,
        auctionDate: parseDate(row["CD"]),
      });

      const booked = await BookedChit.create({
        userId: user._id,
        chitId: chitGroup._id,
        GroupUserId: groupUserId,
        bookingType,
        collectedAmount: toNumber(row["T.Colle.."]),
        pendingAmount: toNumber(row["B.Amount"]),
        monthlyAmount: chitGroup.monthlyContribution,
        dailyAmount: chitGroup.dailyContribution,
        month: parseDate(row["CD"]),
        lastDate: parseDate(row["TD"]),
        auction: auction._id,
      });

      // linkings
      user.chits.push(booked._id);
      user.auction.push(auction._id);
      await user.save();

      if (bookingType === "daily") {
        await WorkerRoute.findByIdAndUpdate(user.route, {
          $push: { DailyChit: booked._id },
        });
      } else {
        await Agent.findByIdAndUpdate(agent._id, {
          $push: { monthlyUsers: booked._id },
        });
      }
    }
  }

  console.log("✅ Excel data fully seeded!");
  process.exit();
};

seedExcel();
