import Enquiry from '../Model/EnquiryModal.js';

export const NewEnquiry = async (req, res) => {
    try {
        const { name, phone, chitPlan, duration, message } = req.body;

        if (!name || !phone || !chitPlan || !duration) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number format' });
        }

        const PhoneVerify = await Enquiry.findOne({ phone });
        if (PhoneVerify) {
            return res.status(200).json({ success: false, message: 'Your Phone number already Exists' });
        }
        const newEnquiry = new Enquiry({
            name,
            phone,
            chitPlan,
            duration,
            message
        });

        await newEnquiry.save();
        res.status(200).json({ success: true, message: 'Your Enquiry has been Submitted Successfully', data: newEnquiry });
    } catch (error) {
        console.error('Error creating enquiry:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}