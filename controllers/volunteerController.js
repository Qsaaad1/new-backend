const asyncHandler = require("express-async-handler");
const Volunteer = require("../models/volunteerModel");

// Controller method to register a volunteer
const registerVolunteer = asyncHandler(async (req, res) => {
    // Extract data from request body
    const { Sr_No, First_Name, Last_name, Gender, Countries, Cities, University_Name, Image_file } = req.body;

    // Check if required fields are present
    if (!Sr_No || !First_Name || !Last_name || !Gender || !Countries || !Cities || !University_Name ) {
        return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

    // Check if Sr_No already exists
    const existingVolunteer = await Volunteer.findOne({ Sr_No });
    if (existingVolunteer) {
        return res.status(400).json({ success: false, message: "Sr_No already exists. Please provide a unique Sr_No" });
    }

    // Create a new volunteer instance
    const newVolunteer = new Volunteer({
        Sr_No,
        First_Name,
        Last_name,
        Gender,
        Countries,
        Cities,
        University_Name,
        // Image_file
    });

    // Save the new volunteer to the database
    await newVolunteer.save();

    // Respond with success message
    res.status(201).json({ success: true, message: "Volunteer registered successfully" });
});

module.exports = { registerVolunteer };
