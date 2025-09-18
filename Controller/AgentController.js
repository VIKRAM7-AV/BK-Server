import Agent from "../Model/AgentModal.js";

export const NewAgent = async (req, res) => {
  try {
    const agent = new Agent(req.body);
    if(!agent.name || !agent.phone || !agent.permanentAddress || !agent.dob){
      return res.status(400).json({ error: "All fields are required" });
    }
    if(!agent.phone.toString().match(/^[6-9]\d{9}$/)){
      return res.status(400).json({ error: "Invalid phone number" });
    }
    if(agent.phone){
      const existingAgent = await Agent.findOne({ phone: agent.phone });
      if (existingAgent) {
        return res.status(400).json({ error: "Phone number already exists" });
      }
    }
    
    await agent.save();
    res.status(200).json({ message: "Agent created successfully", agent });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
