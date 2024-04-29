const dotenv = require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const userRoute = require("./routes/userRoute");
const volunteerRoute = require("./routes/volunteerRoute");
const errorHandler = require("./middleWare/errorMiddleware");
const cookieParser = require("cookie-parser");
const nodemailer = require('nodemailer'); // Added for email functionality
const multer = require('multer');
const User = require('./models/userModel')
const Volunteer = require('./models/volunteerModel');
const Post = require('./models/Post');
const fs = require('fs');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);


// Router Middleware
app.use("/api/users", userRoute);
app.use("/api/volunteers", volunteerRoute);

// Routes
app.get("/", (req, res) => {
  res.send("Home Page");
});

// Error Middleware
app.use(errorHandler);

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new aws.S3();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create a schema for messages
const messageSchema = new mongoose.Schema({
  text: String,
  sender: String, // Add sender field to store the sender information
  receiver: String,
  profile: String,
  status: Boolean,
  role: String,
  createdAt: { type: Date, default: Date.now }
});

// Routes


app.post('/messages', async (req, res) => {
  try {
    const { text, sender, receiver, profile, status, role } = req.body; // Include profile in request body
    const Message = mongoose.model(sender, messageSchema);
    const newMessage = new Message({ text, sender, receiver, profile, status, role, createdAt: new Date() }); // Include profile when creating a new message
    await newMessage.save();
    res.status(201).send('Message sent successfully');
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/messages/admin', async (req, res) => {
  try {
    const { text, sender, receiver, profile, status, role } = req.body; // Include profile in request body
    const Message = mongoose.model(receiver, messageSchema);
    const newMessage = new Message({ text, sender, receiver, profile, status, role, createdAt: new Date() }); // Include profile when creating a new message
    await newMessage.save();
    res.status(201).send('Message sent successfully');
  } catch (err) {
    res.status(500).send(err);
  }
});


app.get('/messages/:sender/:receiver', async (req, res) => {
  try {
    const { sender, receiver } = req.params;
    const Message = mongoose.model(sender, messageSchema);
    const messages = await Message.find({ $or: [
      { sender: sender, receiver: receiver },
      { sender: receiver, receiver: sender }
    ] });
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Route to get last messages for each receiver
app.get('/receivers/:sender', async (req, res) => {
  try {
    const { sender } = req.params;
    const Message = mongoose.model(sender, messageSchema);
    
    // Get distinct receivers from messages sent by the current user
    const receivers = await Message.find({ $or: [{ receiver: sender }, { sender: sender }] }).distinct('receiver');
    
    // Retrieve the last message for each receiver or sender sorted by createdAt
    const receiverData = await Promise.all(receivers.map(async (receiver) => {
      const lastMessage = await Message.findOne({ $or: [{ receiver, sender }, { receiver: sender, sender: receiver }] }).sort({ createdAt: -1 });
      const unreadMessagesCount = await Message.countDocuments({ receiver: sender, sender: receiver, status: false, role: "user" });
      return {
        receiver,
        lastText: lastMessage ? lastMessage.text : '',
        lastTime: lastMessage ? lastMessage.createdAt : null,
        profile: lastMessage ? lastMessage.profile : null,
        unreadCount: unreadMessagesCount
      };
    }));

    // Filter out the sender from receiverData
    const filteredReceiverData = receiverData.filter(item => item.receiver !== sender);

    // Sort filteredReceiverData by lastTime
    filteredReceiverData.sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return b.lastTime - a.lastTime;
    });
    
    res.status(200).json(filteredReceiverData);
  } catch (err) {
    console.error("Error fetching receivers:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/admin/receivers/:sender', async (req, res) => {
  try {
    const { sender } = req.params;
    const Message = mongoose.model(sender, messageSchema);
    
    // Get distinct receivers from messages sent by the current user
    const receivers = await Message.find({ $or: [{ receiver: sender }, { sender: sender }] }).distinct('receiver');
    
    // Retrieve the last message for each receiver or sender sorted by createdAt
    const receiverData = await Promise.all(receivers.map(async (receiver) => {
      const lastMessage = await Message.findOne({ $or: [{ receiver, sender }, { receiver: sender, sender: receiver }] }).sort({ createdAt: -1 });
      const unreadMessagesCount = await Message.countDocuments({ receiver, sender, status: false, role: "admin" });
      return {
        receiver,
        lastText: lastMessage ? lastMessage.text : '',
        lastTime: lastMessage ? lastMessage.createdAt : null,
        profile: lastMessage ? lastMessage.profile : null,
        unreadCount: unreadMessagesCount
      };
    }));

    // Filter out the sender from receiverData
    const filteredReceiverData = receiverData.filter(item => item.receiver !== sender);

    // Sort filteredReceiverData by lastTime
    filteredReceiverData.sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return b.lastTime - a.lastTime;
    });
    
    res.status(200).json(filteredReceiverData);
  } catch (err) {
    console.error("Error fetching receivers:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Endpoint to get list of collections
app.get('/user-collections', async (req, res) => {
  try {
    // Fetch all users from the 'users' collection
    const users = await User.find();

    // Filter out users with role 'admin'
    const filteredUsers = users.filter(user => user.role !== 'admin');

    // Sort the filtered users alphabetically by fullname
    const sortedUsers = filteredUsers.sort((a, b) => a.name.localeCompare(b.name));

    // Send the sorted user data
    res.json(sortedUsers);
  } catch (error) {
    console.error('Error fetching user collections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get list of collections
app.get('/volunteer-collections', async (req, res) => {
  try {
    // Fetch all users from the 'users' collection
    const volunteers = await Volunteer.find();

    // Send the sorted user data
    res.json(volunteers);
  } catch (error) {
    console.error('Error fetching user collections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



//////////////////////////////////////////google Auth///////////////////////////////////////////////////////////////

// Initialize Passport
app.use(passport.initialize());

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: `2063475463-eraptplvqbdff7btbu819mok00olsapl.apps.googleusercontent.com`,
      clientSecret: `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`,
      callbackURL: "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      // Extract user data from profile
      const userData = {
        id: profile.id,
        fullname: profile.displayName,
        email: profile.emails[0].value,
      };
      // Pass user data to the next middleware
      return done(null, userData);
    }
  )
);

// Define routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get('/auth/google/callback',
passport.authenticate('google', { session: false }),
(req, res) => {
  // Handle successful authentication
  // Assuming req.user contains the user data
  const userData = req.user;
  
  // Respond with user data
  // res.json(userData);
  
  res.redirect(`${process.env.FRONTEND_URL}/register?userdata=${JSON.stringify(userData)}`);
}
);

////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////





///////////////////////scholarship/////////////////////////////////////////

const scholarshipSchema = new mongoose.Schema({
  id: String,
  name: String,
  photo: String, // Change field type to String
  funding: String,
  eligibility: String,
  process: String,
  dates: Date,
  requirements: String,
  additional: String
});

const Scholarship = mongoose.model('Scholarship', scholarshipSchema);

// Routes

app.get('/scholarships/:id', async (req, res) => {
  try {
    const scholarship = await Scholarship.findOne({ id: req.params.id });
    res.json(scholarship);
  } catch (err) {
    console.error('Error fetching scholarship:', err);
  
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST route to create a new scholarship
app.post('/scholarship', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { id,name, funding, eligibility, process, dates, requirements, additional } = req.body;
    
    // Upload photo to S3
    const params = {
      Bucket: 'aspiring-abroad-bucket',
      Body: file.buffer,
      Key: file.originalname, // Use a unique key for the file
      ContentType: file.mimetype
    };

    s3.upload(params, async (err, data) => {
      if (err) {
        console.error('Error uploading photo:', err);
        return res.status(500).send('Error uploading photo');
      }

      // Create a new scholarship document in the database
      const scholarshipDoc = await Scholarship.create({
        id,
        name,
        photo: data.Location, // Save the S3 URL to the photo field
        funding,
        eligibility,
        process,
        dates,
        requirements,
        additional
      });

      res.json(scholarshipDoc);
    });
  } catch (error) {
    console.error('Error creating scholarship:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET route to fetch all scholarships
app.get('/scholarships', async (req, res) => {
  try {
    const scholarships = await Scholarship.find({});
    res.json(scholarships);
  } catch (err) {
    console.error('Error fetching scholarships:', err);
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route for updating a scholarship
app.put('/scholarship/:id', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { name, funding, eligibility, process, dates, requirements, additional } = req.body;

  try {
    // Find the scholarship by ID
    let scholarship = await Scholarship.findOne({ id: id });

    if (!scholarship) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }

    // Update the scholarship fields
    scholarship.name = name;
    scholarship.funding = funding;
    scholarship.eligibility = eligibility;
    scholarship.process = process;
    scholarship.dates = dates;
    scholarship.requirements = requirements;
    scholarship.additional = additional;

    if (req.file) {
      const file = req.file;
    // Upload photo to S3
    const params = {
      Bucket: 'aspiring-abroad-bucket',
      Body: file.buffer,
      Key: file.originalname, // Use a unique key for the file
      ContentType: file.mimetype
    };

    const data = await s3.upload(params).promise();

      scholarship.photo = data.Location;
  }

    // Save the updated scholarship
    await scholarship.save();

    res.json({ message: 'Scholarship updated successfully', data: scholarship });
  } catch (error) {
    console.error('Error updating scholarship:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




////////////////////////////////////////////////////////////////



///////////////////////blog/////////////////////////////////////////

app.post('/post', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { title, summary, content } = req.body;
    const params = {
      Bucket: 'aspiring-abroad-bucket',
      Body: file.buffer,
      Key: file.originalname,
      ContentType: file.mimetype
    };
  
    // Upload to S3
    s3.upload(params, async (err, data) => {
      if (err) {
        console.error('Error uploading image:', err);
        return res.status(500).send('Error uploading image');
      }
    
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: data.Location,
    });

    res.json(postDoc);
      
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/post/:id', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { title, summary, content } = req.body;

  try {
    // Find the post by ID
    const postDoc = await Post.findById(id);

    if (!postDoc) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Set the cover to the existing cover path or null
    let cover = postDoc.cover;

    // Check if a new file is uploaded
    if (req.file) {
      const file = req.file;

      // Upload new cover image to S3
      const params = {
        Bucket: 'aspiring-abroad-bucket',
        Body: file.buffer,
        Key: file.originalname, // Use a unique key for the file
        ContentType: file.mimetype
      };

      const data = await s3.upload(params).promise();

      // Update the cover path with the new image URL
      cover = data.Location;
    }

    // Update the post fields
    const updatedPost = await Post.findByIdAndUpdate(id, {
      title,
      summary,
      content,
      cover,
    }, { new: true });

    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/post', async (req,res) => {
  try {
    res.json(
      await Post.find()
      .sort({createdAt: -1})
      .limit(20)
    );
  } catch (error) {
    console.error('Error creating post:', error);
  res.status(500).json({ error: 'Internal server error' });
}
});

app.get('/blog/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const postDoc = await Post.findById(id);
    res.json(postDoc);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

////////////////////////////////////////////////////////////////

app.get('/api/:user', async (req, res) => {
  const { user } = req.params;
  try {
    // Fetch user data from MongoDB, selecting only the specified fields
    const userData = await User.findOne({name:user}, 'name email fullname phonenumber pincode');
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/:volunteer', async (req, res) => {
  const { volunteer } = req.params;
  try {
    // Fetch user data from MongoDB, selecting only the specified fields
    const userData = await User.findOne({name:user}, 'name email fullname phonenumber pincode');
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

///////////////////////Notification//////////////////////////

const notificationSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  profile: String,
  role: String,
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model("Notification", notificationSchema);

// Define route to receive and store messages
app.post("/notification", async (req, res) => {
  try {
    const { sender, receiver, text, profile, role } = req.body;
    const notification = new Notification({ sender, receiver, text, profile, role });
    await notification.save();
    res.status(201).json({ message: "notification stored successfully" });
  } catch (error) {
    console.error("Error storing notification:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE endpoint to delete a notification by ID
app.delete('/notifications/:id', async (req, res) => {
  const notificationId = req.params.id;

  try {
    // Find the notification by ID and delete it
    await Notification.findByIdAndDelete(notificationId);
    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get("/notifications/:userName", async (req, res) => {
  try {
    const userName = req.params.userName;
    const notifications = await Notification.find({ receiver: userName }).sort({
      createdAt: -1,
    });
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/admin/notifications/:userName", async (req, res) => {
  try {
    const userName = req.params.userName;
    const notifications = await Notification.find({ role: "admin" }).sort({
      createdAt: -1,
    });
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

////////////////////////////////////////////////////////////////
app.get('/:receiver/:sender', async (req, res) => {
  try {
    const { receiver, sender } = req.params;
    const [firstName, lastName] = receiver.split(' ');
    const Message = mongoose.model(sender, messageSchema);
    
    // Find receiver based on first and last name
    const volunteer = await Volunteer.find({
      First_Name: firstName,
      Last_name: lastName,
    });
    
    // Update status of messages where receiver matches
    await Message.updateMany({ sender: receiver, status: false, role: "user" }, { $set: { status: true } });
    await Notification.deleteMany({ sender: receiver, receiver: sender, role: "user" });

    res.status(200).send(volunteer);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/admin/:receiver/:sender', async (req, res) => {
  try {
    const { receiver, sender } = req.params;
    const [firstName, lastName] = receiver.split(' ');
    const Message = mongoose.model(sender, messageSchema);
    
    // Find receiver based on first and last name
    const volunteer = await Volunteer.find({
      First_Name: firstName,
      Last_name: lastName,
    });
    
    // Update status of messages where receiver matches
    await Message.updateMany({ sender: sender, status: false, role: "admin" }, { $set: { status: true } });
    await Notification.deleteMany({ sender: sender, receiver: receiver, role: "admin" });


    res.status(200).send(volunteer);
  } catch (err) {
    res.status(500).send(err);
  }
});


// Connect to DB and start server
const PORT = 8000;
// mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server Running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));