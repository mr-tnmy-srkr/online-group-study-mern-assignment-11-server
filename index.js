const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//mongodb connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@groupstudycluster.bgrpf96.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const assignmentCollection = client
  .db("assignmentDB")
  .collection("assignments");
const submittedAssignmentCollection = client
  .db("assignmentDB")
  .collection("submittedAssignments");

//middleware
const logger = (req, res, next) => {
  console.log("log-info", req.method, req.url);
  next();
};
//verify token and grant access
const gateman = (req, res, next) => {
  const token = req?.cookies?.token;
  // or
  // const { token } = req.cookies
  // console.log(token);

  //if client does not send token
  if (!token) {
    return res.status(401).send({ message: "You are not authorized1" });
  }
  // verify a token symmetric
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "You are not authorized2" });
    }
    // attach decoded user so that others can get it
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    //get all assignments
    app.get("/api/v1/assignments", async (req, res) => {
      const cursor = assignmentCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //get particular assignment by id
    app.get("/api/v1/assignments/:assignmentId", async (req, res) => {
      const id = req.params.assignmentId;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.findOne(query);
      res.send(result);
    });
    //get all submitted-assignment
    app.get("/api/v1/submitted-assignments", async (req, res) => {
      const query = {status:"pending"};
      const cursor = submittedAssignmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //jwt access token
    app.post("/api/v1/auth/access-token", logger, async (req, res) => {
      // creating token and send to client
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: 60 * 60,
      });
      //  console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/api/v1/auth/user/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    app.post("/api/v1/user/create-assignment", async (req, res) => {
      const data = req.body;
      // console.log(data);
      const result = await assignmentCollection.insertOne(data);
      res.send(result);
    });
    app.post("/api/v1/user/submit-assignment", async (req, res) => {
      const data = req.body;
      // console.log(data);
      const result = await submittedAssignmentCollection.insertOne(data);
      res.send(result);
    });

    //update a single product
    app.put(
      "/api/v1/assignments/update-assignment/:assignmentId",
      async (req, res) => {
        const id = req.params.assignmentId;
        const data = req.body;
        console.log("id:", id, "Data:", data);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateProduct = {
          $set: {
            title: data.title,
            thumbnail: data.thumbnail,
            marks: data.marks,
            date: data.date,
            difficultyLevel: data.difficultyLevel,
            description: data.description,
          },
        };
        const result = await assignmentCollection.updateOne(
          filter,
          updateProduct,
          options
        );
        res.send(result);
      }
    );

    //delete a assignment by creator
    app.delete(
      "/api/v1/user/delete-assignment/:assignmentId",
      gateman,
      async (req, res) => {
        const tokenEmail = req.user.email;
        const id = req.params.assignmentId;
        const query = {
          $and: [{ _id: new ObjectId(id) }, { user: tokenEmail }],
        };
        const result = await assignmentCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Send a ping to confirm a successful connection
    client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
