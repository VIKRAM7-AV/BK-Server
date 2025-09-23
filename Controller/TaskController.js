import Task from '../Model/TaskModel.js';
import Agent from '../Model/AgentModal.js';

export const CreateTask = async (req, res) => {
  try {
    const { Route, assignedTo } = req.body;
    if (!Route || !assignedTo) {
      return res.status(400).json({ message: "Route and assignedTo are required" });
    }
    const Reassigned = await Agent.findOne({ route: Route });
    if (!Reassigned) {
      return res.status(404).json({ message: "No agent found for the given route" });
    }
    const newTask = new Task({ Route, assignedTo, ReassignedTo: Reassigned._id });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const GetTasks = async (req, res) => {
    try {
        const {id} = req.body;
        const tasks = await Task.find({ assignedTo: id });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });        
    }
}

export const todayTask = async (req, res) => {
  try {
    const { id } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const tasks = await Task.find({
      assignedTo: id,
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    }).populate({ path: "assignedTo", select: "name agentId" }).populate({ path: "ReassignedTo", select: "name agentId" }).populate({ path: "Route" });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
