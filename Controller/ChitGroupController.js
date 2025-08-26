import ChitGroup from "../Model/ChitGroup.js";

export const ChitGroupController = async (req, res) => {
    try {
      const newChitGroup = new ChitGroup(req.body);
      await newChitGroup.save();
      res.status(200).json(newChitGroup);
    } catch (error) {
      res.status(500).json({ message: "Error creating chit group", error });
    }
  };

  export const AllChitGroup = async (req, res) => {
    try {
      const chitGroups = await ChitGroup.find();
      res.status(200).json(chitGroups);
    } catch (error) {
      res.status(500).json({ message: "Error fetching chit groups", error });
    }
  };