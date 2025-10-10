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


