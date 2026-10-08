const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://demo:demo@cluster0.mongodb.net/airtelcoin?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  airtelCoins: { type: Number, default: 0 },
  usdtBalance: { type: Number, default: 0 },
  energy: { type: Number, default: 1000 },
  referrals: { type: Number, default: 0 },
  walletAddress: { type: String, default: "" },
  completedTasks: [String]
});
const User = mongoose.model('User', userSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
  title: String,
  type: String, // 'youtube_watch', 'youtube_sub', 'telegram'
  link: String,
  videoId: String,
  duration: Number, // seconds mein
  rewardCoins: Number,
  rewardUsdt: Number
});
const Task = mongoose.model('Task', taskSchema);

// 1. Get or Create User
app.post('/api/user', async (req, res) => {
  const { telegramId, name } = req.body;
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, name });
    await user.save();
  }
  res.json({ success: true, user });
});

// 2. Tap Mining API
app.post('/api/tap', async (req, res) => {
  const { telegramId, count } = req.body;
  const user = await User.findOne({ telegramId });
  if (user && user.energy >= count) {
    user.airtelCoins += count;
    user.energy -= count;
    await user.save();
    res.json({ success: true, airtelCoins: user.airtelCoins, energy: user.energy });
  } else {
    res.status(400).json({ success: false, message: "Low energy" });
  }
});

// 3. Get Active Tasks
app.get('/api/tasks', async (req, res) => {
  const tasks = await Task.find();
  res.json({ success: true, tasks });
});

// 4. Complete Video Task (Anti-Cheat Server Verification)
app.post('/api/complete-task', async (req, res) => {
  const { telegramId, taskId, watchedDuration } = req.body;
  const user = await User.findOne({ telegramId });
  const task = await Task.findById(taskId);

  if (!task || !user) return res.status(404).json({ success: false });

  if (user.completedTasks.includes(taskId)) {
    return res.json({ success: false, message: "Pehle se complete ho chuka hai" });
  }

  // Verification Logic
  if (task.type === 'youtube_watch' && watchedDuration < task.duration) {
    return res.status(400).json({ success: false, message: "Poori video nahi dekhi" });
  }

  user.airtelCoins += task.rewardCoins || 0;
  user.usdtBalance += task.rewardUsdt || 0;
  user.completedTasks.push(taskId);
  await user.save();

  res.json({ success: true, message: "Reward credited!", user });
});

// 5. Admin API: Naya Task (YouTube Watch/Subscribe) Add Karna
app.post('/api/admin/add-task', async (req, res) => {
  const newTask = new Task(req.body);
  await newTask.save();
  res.json({ success: true, task: newTask });
});

// 6. Wallet Save / Withdrawal Request
app.post('/api/wallet', async (req, res) => {
  const { telegramId, walletAddress } = req.body;
  const user = await User.findOneAndUpdate({ telegramId }, { walletAddress }, { new: true });
  res.json({ success: true, user });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
