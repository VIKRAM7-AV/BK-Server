import WorkerRoute from '../Model/WorkerRoute.js';

export const NewRoute = async (req, res) => {
    try {
        const {place}= req.body;
        if(!place){
            return res.status(400).json({ error: "Place field is required", success: false });
        }
        const newRoute = new WorkerRoute({
            place,
        });
        await newRoute.save();
        res.status(201).json({ message: "New route created successfully", data: newRoute, success: true });
    } catch (error) {
        res.status(400).json({ error: error.message, success: false });
        console.error("Error creating new route:", error);
    }
}


export const AllRoute = async (req, res) => {
    try {
        const routes = await WorkerRoute.find();
        res.status(200).json({ message: "All routes fetched successfully", data: routes });
    } catch (error) {
        console.error("Error fetching all routes:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

