const express = require("express")
const app = express()
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()
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

    //User related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.post("/users", async (req, res) => {
      const user = req.body
      //insert email if user does not exits:
      //You can do this many ways (1. email unique, 2.upsert, 3.simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch("/users/moderator/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "moderator",
        },
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    //Top Scholarship Related
    app.get("/topScholarship", async (req, res) => {
      const result = await topScholarshipCollection.find().toArray()
      res.send(result)
    })

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
      const query = { email: email }
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
