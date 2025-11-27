import Task from "../Model/TaskModel.js";
import Agent from "../Model/AgentModal.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import {Expo} from "expo-server-sdk";

let expo = new Expo();

export const CreateTask = async (req, res) => {
  try {
    const { Route, assignedTo } = req.body;

    if (!Route || !assignedTo) {
      return res
        .status(400)
        .json({ message: "Route and assignedTo are required" });
    }

    const routeExists = await WorkerRoute.findById(Route);
    if (!routeExists) {
      return res.status(404).json({ message: "Route not found" });
    }

    const routeAgent = await Agent.findOne({ route: Route });
    if (!routeAgent) {
      return res
        .status(404)
        .json({ message: "No agent found for the given route" });
    }

    const assignedAgent = await Agent.findById(assignedTo).select(
      "name expoPushToken"
    );
    if (!assignedAgent) {
      return res.status(404).json({ message: "Assigned agent not found" });
    }

    // 3. Create the task
    const newTask = new Task({
      Route,
      assignedTo,
      ReassignedTo: routeAgent._id,
      // add any other fields you need
    });
    await newTask.save();

    // 4. Send Push Notification to the assigned agent
    if (
      assignedAgent.expoPushToken &&
      Expo.isExpoPushToken(assignedAgent.expoPushToken)
    ) {
      const message = {
        to: assignedAgent.expoPushToken,
        sound: "default",
        title: "New Task Assigned 🚀",
        body: `You have been assigned a new collection task for Route: ${routeExists.place}\nPlease check the app for details.`,
        data: {
          type: "new_task",
          taskId: newTask._id,
          route: Route,
        },
      };

      try {
        await expo.sendPushNotificationsAsync([message]);
      } catch (pushError) {
        console.error("Expo push error:", pushError.message);
      }
    } else {
      console.log(
        `No valid Expo token for agent: ${assignedAgent.name || assignedTo}`
      );
    }

    res.status(200).json({
      message: "Task created and notification sent successfully",
      task: newTask,
    });
  } catch (error) {
    console.error("Error in CreateTask:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const GetTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await Task.find({ assignedTo: id }).populate("Route");
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const todayTask = async (req, res) => {
  try {
    const { id } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const tasks = await Task.find({
      assignedTo: id,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    })
      .populate({ path: "assignedTo", select: "name agentId" })
      .populate({ path: "ReassignedTo", select: "name agentId" })
      .populate({ path: "Route" });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const GetRoutes = async (req, res) => {
  try {
    const { routeId } = req.params;
    const routes = await WorkerRoute.find({ _id: routeId }).populate({
      path: "DailyChit",
      populate: [{ path: "userId" }, { path: "chitId" }],
    });
    res.status(200).json({ data: routes, success: true });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
    console.error("Error fetching routes:", error);
  }
};
