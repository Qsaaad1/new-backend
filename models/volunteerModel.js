const mongoose = require('mongoose');
const {Schema,model} = mongoose;

const volunteerSchema = new Schema({
    Sr_No: { type: Number, unique: true },
    First_Name: String,
    Last_name: String,
    Gender: String,
    Countries: String,
    Cities: String,
    University_Name: String,
    Image_file: String
});


// Create mongoose model
const Volunteer = model('Volunteer', volunteerSchema);

module.exports = Volunteer;