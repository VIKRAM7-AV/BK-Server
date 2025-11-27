import Agent from "../Model/AgentModal.js";
import WorkerRoute from "../Model/WorkerRoute.js";

export const NewRoute = async (req, res) => {
  try {
    const { place } = req.body;
    if (!place) {
      return res
        .status(400)
        .json({ error: "Place field is required", success: false });
    }
    const newRoute = new WorkerRoute({
      place,
    });
    await newRoute.save();
    res
      .status(201)
      .json({
        message: "New route created successfully",
        data: newRoute,
        success: true,
      });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
    console.error("Error creating new route:", error);
  }
};

export const AllRoute = async (req, res) => {
  try {
    const routes = await WorkerRoute.find();
    res
      .status(200)
      .json({ message: "All routes fetched successfully", data: routes });
  } catch (error) {
    console.error("Error fetching all routes:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const AllRouteAgent = async (req, res) => {
  try {
    // WorkerRoute collection-la irundhu ella routes-um eduthu,
    // adhuoda related agents-um populate pannu
    const routesWithAgents = await WorkerRoute.find()
      .populate({
        path: "DailyChit", // optional, if you need booked chits too
        select: "userId chitAmount",
      })
      .lean(); // performance boost

    // Har route-kkum anaa agent yaaru-nu find pannuradhu
    const routesFinal = await Promise.all(
      routesWithAgents.map(async (route) => {
        // Idd route-la irukka agents-ah find pannu
        const agentsInThisRoute = await Agent.find({ route: route._id })
          .select("agentId name profile")
          .lean();

        return {
          ...route,
          agents: agentsInThisRoute.length > 0 ? agentsInThisRoute : [], // empty array if no agent
        };
      })
    );

    res.status(200).json({
      message: "All routes with assigned agents fetched successfully",
      count: routesFinal.length,
      data: routesFinal,
    });
  } catch (error) {
    console.error("Error fetching routes with agents:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const UpdateRoute = async (req, res) => {
  try {
    const routeId = req.params.id;
    const { place } = req.body;
    if (!place) {
      return res
        .status(400)
        .json({ error: "Place field is required", success: false });
    }

    const route = await WorkerRoute.findById(routeId);
    if (!route) {
      return res.status(404).json({ error: "Route not found", success: false });
    }
    route.place = place;
    await route.save();
    res
      .status(200)
      .json({
        message: "Route updated successfully",
        data: route,
        success: true,
      });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
    console.error("Error creating new route:", error);
  }
};
