const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

console.log("Starting transactions service...");
console.log("MongoDB URI:", process.env.MONGO_URI || "mongodb://mongo:27017/bank_app");

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const mongoUri = process.env.MONGO_URI || "mongodb://mongo:27017/bank_app";
const client = new MongoClient(mongoUri);

async function connectToMongo() {
  try {
    console.log("Attempting MongoDB connection...");
    await client.connect();
    await client.db("bank_app").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}

connectToMongo();

app.get("/", (req, res) => {
  res.json({
    message: "Transactions service is running",
    endpoint: "/api/transactions"
  });
});

app.get("/api/transactions", async (req, res) => {
  try {
    const db = client.db("bank_app");
    const users = await db.collection("users").find({}).toArray();

    const grouped = {};

    users.forEach(user => {
      if (user.transactions && user.transactions.length > 0) {
        user.transactions.forEach(t => {
          const date = new Date(t.date);

          const month = date.toLocaleString("default", {
            month: "long",
            year: "numeric"
          });

          if (!grouped[month]) {
            grouped[month] = [];
          }

          grouped[month].push({
            type: t.type,
            amount: t.amount,
            date: t.date
          });
        });
      }
    });

    const result = Object.keys(grouped).map(month => ({
      month: month,
      transactions: grouped[month]
    }));

    res.json(result);
  } catch (err) {
    console.error("Error loading transactions:", err);
    res.status(500).json({
      error: "Server Error",
      details: err.message
    });
  }
});

app.get("/api/transactions/:userId", async (req, res) => {
  try {
    const db = client.db("bank_app");

    let userId;
    try {
      userId = new ObjectId(req.params.userId);
    } catch (err) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      userName: `${user.first_name} ${user.last_name}`,
      transactions: user.transactions || []
    });
  } catch (err) {
    console.error("Error processing request:", err);
    res.status(500).json({
      error: "Server Error",
      details: err.message
    });
  }
});

app.listen(port, () => {
  console.log(`Transactions service running on http://localhost:${port}`);
});