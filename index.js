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
    // origin: ["http://localhost:5173", "http://localhost:5174"],
    origin: ["http://localhost:5173", "http://localhost:5174","https://online-group-study-mern.web.app", "https://online-group-study-mern.firebaseapp.com","https://online-group-study-mern.netlify.app","https://online-group-study-mern.vercel.app","https://online-group-study-mern.surge.sh"],
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
    // client.connect();

    //get all assignments
    app.get("/api/v1/assignments", async (req, res) => {
      //pagination
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      const cursor = assignmentCollection.find().skip(skip).limit(limit);
      const result = await cursor.toArray();
      // count all data
      const total = await assignmentCollection.countDocuments();
      res.send({ total, result });
    });

    //get particular assignment by id
    app.get("/api/v1/assignments/:assignmentId", gateman, async (req, res) => {
      const id = req.params.assignmentId;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.findOne(query);
      res.send(result);
    });
    //get all submitted-assignment
    app.get("/api/v1/user/submitted-assignments", gateman, async (req, res) => {
      // const tokenEmail = req.user.email;
      const query = { status: "pending" };
      const cursor = submittedAssignmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get single submitted-assignment
    app.get(
      "/api/v1/user/submitted-assignments/:id",
      gateman,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const cursor = submittedAssignmentCollection.findOne(query);
        const result = await cursor;
        res.send(result);
      }
    );
    //get all my-assignment by user email
    app.get("/api/v1/user/my-assignments", gateman, async (req, res) => {
      const tokenEmail = req.user.email;
      const queryEmail = req.query.email;
      // console.log(tokenEmail, queryEmail);
      if (queryEmail !== tokenEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (queryEmail) {
        query.user = queryEmail;
      }
      // console.log(query);
      const cursor = submittedAssignmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //jwt access token
    app.post("/api/v1/auth/access-token", logger, async (req, res) => {
      // creating token and send to client
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: 60 * 60,
      });
      //  console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    //clear cookie when loggedOut
    app.post("/api/v1/auth/user/logOut", logger, async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      // res.clearCookie("token", { maxAge: 0 }).send({ success: true });
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
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
        // console.log("id:", id, "Data:", data);
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
    //update data after giving marks
    app.put(
      "/api/v1/assignments/marking-assignment/:assignmentId",
      async (req, res) => {
        const id = req.params.assignmentId;
        const data = req.body;
        // console.log("id:", id, "Data:", data);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateProduct = {
          $set: {
            myMark: data.myMark,
            feedback: data.feedback,
            status: "completed",
          },
        };
        const result = await submittedAssignmentCollection.updateOne(
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
    // client.db("admin").command({ ping: 1 });
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
