const asyncHandler = require("express-async-handler");
const Volunteer = require("../models/volunteerModel");

// Controller method to register a volunteer
const registerVolunteer = asyncHandler(async (req, res) => {
    // Extract data from request body
    const {  First_Name, Last_name, Gender, Countries, Cities, University_Name, Image_file } = req.body;

    // Check if required fields are present
    if ( !First_Name || !Last_name || !Gender || !Countries || !Cities || !University_Name ) {
        return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

   

    // Create a new volunteer instance
    const newVolunteer = new Volunteer({
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
