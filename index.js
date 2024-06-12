const express = require("express")
const app = express()
const cors = require("cors")
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

//middlewares
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hrdcqgm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect()

    // cart = submit
    const topScholarshipCollection = client
      .db("scholarshipDb")
      .collection("topScholarship")
    const submitCollection = client.db("scholarshipDb").collection("submits")
    const userCollection = client.db("scholarshipDb").collection("users")
    const addScholarshipCollection = client
      .db("scholarshipDb")
      .collection("addScholarship")
    const paymentCollection = client.db("scholarshipDb").collection("payments")
    const reviewCollection = client.db("scholarshipDb").collection("reviews")

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      })
      res.send({ token })
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("Inside verify token", req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" })
      }
      const token = req.headers.authorization.split(" ")[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" })
        }
        req.decoded = decoded
        next()
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === "admin"
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" })
      }
      next()
    }
    // use verify moderator after verifyToken
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isModerator = user?.role === "moderator"
      if (!isModerator) {
        return res.status(403).send({ message: "forbidden access" })
      }
      next()
    }

    //Users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({ admin })
    })

    app.get("/users/moderator/:email", verifyToken, async (req, res) => {
      const email = req.params.email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let moderator = false
      if (user) {
        moderator = user?.role === "moderator"
      }
      res.send({ moderator })
    })

    app.post("/users", async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        }
        const result = await userCollection.updateOne(filter, updatedDoc)
        res.send(result)
      }
    )

    app.patch(
      "/users/moderator/:id",
      verifyToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updatedDoc = {
          $set: {
            role: "moderator",
          },
        }
        const result = await userCollection.updateOne(filter, updatedDoc)
        res.send(result)
      }
    )

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    //Top Scholarship Related
    app.get("/topScholarship", async (req, res) => {
      const page = parseInt(req.query.page || 0)
      const size = parseInt(req.query.size || 10)
      const filter = req.query
      console.log(filter)
      console.log("pagination query", page, size)
      const query = {
        // {"firstname": {$regex: `${thename}`, $options: 'i'}},
      }
      if (filter.search) {
        query.universityName = { $regex: `${filter.search}`, $options: "i" }
      }
      const cursor = topScholarshipCollection
        .find(query)
        .skip(page * size)
        .limit(size)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get("/topScholarshipCount", async (req, res) => {
      const count = await topScholarshipCollection.estimatedDocumentCount()
      res.send({ count })
    })

    app.patch("/topScholarship/:id", async (req, res) => {
      const item = req.body
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          applicationFees: item.applicationFees,
          degreeCategory: item.degreeCategory,
          scholarshipCategory: item.scholarshipCategory,
          subjectCategory: item.subjectCategory,
          universityName: item.universityName,
        },
      }
      const result = await topScholarshipCollection.updateOne(
        filter,
        updatedDoc
      )
      res.send(result)
    })

    app.delete(
      "/topScholarship/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await topScholarshipCollection.deleteOne(query)
        res.send(result)
      }
    )

    app.get("/topScholarship/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: {
          universityName: 1,
          universityImage: 1,
          scholarshipCategory: 1,
          applicationDeadline: 1,
          subjectCategory: 1,
          applicationFees: 1,
          scholarshipDescription: 1,
          _id: 1,
          universityLocation: 1,
        },
      }
      const result = await topScholarshipCollection.findOne(query, options)
      res.send(result)
    })

    //submit collection
    // carts = submits
    app.get("/submits", async (req, res) => {
      const email = req.query.email
      let query = {}
      if (email) {
        query = { email }
      }
      console.log(query)
      const result = await submitCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/submits", async (req, res) => {
      const submitItem = req.body
      const result = await submitCollection.insertOne(submitItem)
      res.send(result)
    })

    app.delete("/submits/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await submitCollection.deleteOne(query)
      res.send(result)
    })

    //add Scholarship
    app.post("/addScholarship", verifyToken, verifyAdmin, async (req, res) => {
      const scholarship = req.body
      const result = await addScholarshipCollection.insertOne(scholarship)
      res.send(result)
    })

    app.get("/addScholarship", async (req, res) => {
      const result = await addScholarshipCollection.find().toArray()
      res.send(result)
    })

    //Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body
      const amount = parseInt(price * 100)
      console.log("amount inside the intent", amount)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    app.post("/payments", async (req, res) => {
      const payment = req.body
      const paymentResult = await paymentCollection.insertOne(payment)
      //carefully delete each item from the cart
      console.log("payment info", payment)
      const query = {
        _id: {
          $in: payment.submitIds.map((id) => new ObjectId(id)),
        },
      }
      const deleteResult = await submitCollection.deleteMany(query)
      res.send({ paymentResult, deleteResult })
    })

    //add review
    app.post("/addReview", async (req, res) => {
      const item = req.body
      const result = await reviewCollection.insertOne(item)
      res.send(result)
    })

    app.get("/addReview", async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })
    app.get("/addReview/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await reviewCollection.findOne(query)
      res.send(result)
    })

    app.patch('/addReview/:id', async(req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          ratingPoint: item.ratingPoint,
          reviewDate: item.reviewDate,
          scholarshipName: item.scholarshipName,
          universityName: item.universityName,
          reviewComment: item.reviewComment,
          image: item.image
        }
      }
      const result = await reviewCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete("/addReview/:id", verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await reviewCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 })
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("Scholarship Management System is running")
})

app.listen(port, () => {
  console.log(`Scholarship Management System is running on port ${port}`)
})
