/*Importera*/
var express = require("express")
var bodyParser = require("body-parser")
var path = require("path")
var bcrypt = require('bcrypt')
var session = require('express-session')
var MongoStore = require('connect-mongo')(session)
var cors = require('cors')
var mongoose = require('mongoose')

const allowedOrigins = [
    'http://www.willbur.nu/blog-webshop/webbshop.html',
    'https://www.willbur.nu/blog-webshop/webbshop.html',
    'http://willbur.nu/blog-webshop/webbshop.html',
    'https://willbur.nu/blog-webshop/webbshop.html',
]

/*Skapar instans av express*/
var app = express()

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', true)
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.append('Access-Control-Allow-Headers', 'Content-Type')
    next()
})

/*body parser middleware*/
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

/*Skapa statisk sökväg*/
app.use(express.static(path.join(__dirname, 'public')))

/*Anslut till mongoDB med mongoose */
let url = 'mongodb+srv://miun-user:Soulfood71@cluster0.ybcm5.mongodb.net/blog-webshop?retryWrites=true&w=majority'
const connectionParams = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
}
const devMode = false
let server
let database
let connection
if (devMode) {
    server = '127.0.0.1:27017'
    database = 'blog-webshop'
    url = `mongodb://${server}/${database}`
    connection = mongoose.createConnection(url, connectionParams)
} else {
    connection = mongoose.createConnection(url, connectionParams)
}

app.use(cors())
app.use(session({
    secret: 'work hard',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
    store: new MongoStore({
        mongooseConnection: connection
    })
}))

function getCurrentDate() {
    let date_obj = new Date()
    //Day
    let date = ("0" + date_obj.getDate()).slice(-2)
    //Month
    let month = ("0" + (date_obj.getMonth() + 1)).slice(-2)
    //Year
    let year = date_obj.getFullYear()
    //Hours
    let hours = date_obj.getHours()
    //Minutes
    let minutes = date_obj.getMinutes()
    //Seconds
    let seconds = date_obj.getSeconds()

    //date & time in YYYY-MM-DD HH:MM:SS format
    return year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds
}

app.get("/user/loggedin",cors(), (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send({ "message": "användare inte inloggad" })
    }
    return res.status(200).send({ "message": "användare innloggad" })
})

/*Login*/
app.post("/user/login",cors(), (req, res) => {
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection succesful')
            mongoose.connection.db.collection("users").find({ user_name: req.body.cred.userName }).toArray((err, data) => {
                if (data[0] == null) {
                    console.log("Authentication failed")
                    return res.status(401).send({ "message": "Inloggning misslyckades" })
                }
                var password_form_database = data[0].password
                var _id_from_database = data[0]._id
                bcrypt.compare(req.body.cred.password, password_form_database, (err, result) => {
                    if (result === true) {
                        req.session.userId = _id_from_database
                        return res.status(200).send({ "message": "Inloggning lyckades" })
                    } else {
                        console.log("Authentication failed")
                        return res.status(401).send({ "message": "Inloggning misslyckades" })
                    }
                })
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})
/*Logout*/
app.post("/user/logout",cors(), (req, res) => {
    if (req.session) {
        // delete session object
        req.session.destroy((err) => {
            if (err) {
                console.log("Logout failed")
            } else {
                return res.status(200).send({ "message": "Utloggning lyckades" })
            }
        })
    }
})
/*Skapar användare*/
app.post("/user/create",cors(), (req, res) => {
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection succesful')
            mongoose.connection.db.collection("users").find({ user_name: req.body.userName }).toArray((err, data) => {
                if (data[0] != null) {
                    console.log('Username already present')
                    return res.status(403).send({ "message": "En användare med användarnamn " + req.body.userName + " finns redan" })
                }
                mongoose.connection.db.collection("users").find({}, { sort: { userId: -1 } }).toArray((err, data) => {
                    var newId = 0
                    if (data[0] != null) {
                        newId = parseInt(data[0].userId) + 1
                    }
                    bcrypt.hash(req.body.password, 10)
                        .then((val) => {
                            let newUser = {
                                userId: newId,
                                first_name: req.body.firstName,
                                last_name: req.body.lastName,
                                user_name: req.body.userName,
                                email: req.body.email,
                                password: val
                            }
                            res.status(201).send({ "message": "Lägger till användare" })
                            mongoose.connection.db.collection("users").insertOne(newUser, () => {
                                console.log("1 document inserted")
                            })
                        })
                        .catch(err => {
                            console.error('Hashing error')
                            return res.status(500).send({ "message": "Fel vid registrering av användare" })
                        })
                })
            })
        })

        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})


/*Hämtar användare*/
app.get("/user/get",cors(), (req, res) => {
    /*Connect to mongoDB*/
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection sucessful')
            mongoose.connection.db.collection("users").find().toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})

/*Hämtar användar id*/
app.get("/user/get/:userId",cors(), (req, res) => {
    var userId = parseInt(req.params.userId);
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection successful')
            mongoose.connection.db.collection("users").find({ userId: userId }).toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" });
        })
})

/*Läger till bloggpost*/
app.post("/blogg/posts/add",cors(), (req, res) => {
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection succesful')
            /*i kollectionen posts vill jag sortera ut allt 
            (find({} räknat baklänges ifrån omvänd ordning och plocka ut ett värde vilket
                 är det första som kommer vara det sista eftersom det sortera omvänd ordning.
                 Detta gör jag för att inte få en undefined variabel på postID i objektet newPpost*/
            mongoose.connection.db.collection("posts").find({}, { sort: { postId: -1 } }).limit(1).toArray((err, data) => {
                let newId = 0
                if (data[0] != null) {
                    newId = parseInt(data[0].postId) + 1
                }
                let postDate = getCurrentDate()
                let newPost = {
                    postId: newId,
                    userName: req.body.userName,
                    title: req.body.title,
                    content: req.body.content,
                    postDate: postDate
                }
                mongoose.connection.db.collection("posts").insertOne(newPost, (err, res) => {
                    if (err) throw err
                    console.log("1 document inserted")
                })
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
    return res.status(201).send({ "message": "Lägger till bloggpost" })
})


/*Tar bort bloggpost*/
app.delete("/blogg/posts/delete/:id",cors(), (req, res) => {
    var deleteId = parseInt(req.params.id)
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection successful')
            mongoose.connection.db.collection("posts").deleteMany({ postId: deleteId }, (err, _) => {
                if (err) {
                    console.log(err)
                }

            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
    return res.status(200).send({ "message": "Raderar bloggpost med id " + deleteId })
})

//hämtar alla blogginlägg 
app.get("/blogg/posts/get",cors(), (req, res) => {
    /*Connect to mongoDB*/
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection sucessful')
            mongoose.connection.db.collection("posts").find().toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})

/*Hämtar produkter*/
app.get("/products/get",cors(), (req, res) => {
    /*Connect to mongoDB*/
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection sucessful')
            mongoose.connection.db.collection("products").find().toArray((err, data) => {
                for (let i = 0; i < data.length; i++) {
                    /* If qty of product is 0 remove it from the data array */
                    if (data[i].qty < 1) {
                        data.splice(i, 1)
                    }
                }
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})

/*Hämtar vald produkt*/
app.get("/products/get/:itemId",cors(), (req, res) => {
    var itemId = parseInt(req.params.itemId)
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection successful')
            mongoose.connection.db.collection("products").find({ itemId: itemId }).toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})

app.get("/products/get/:catId",cors(), (req, res) => {
    var catId = parseInt(req.params.catId)
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection successful')
            mongoose.connection.db.collection("products").find({ catId: catId }).toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })
})

app.post("/order/place",cors(), (req, res) => {
    let transporter = nodeMailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            // should be replaced with real sender's account
            user: 'dvgb06sender@gmail.com',
            pass: '?6sw^P3`'
        }
    })
    let message = "Email: " + req.body.email + "\n"
    message += "Firstname: " + req.body.firstname + "\n"
    message += "Lastname: " + req.body.lastname + "\n"
    message += "Country: " + req.body.country + "\n"
    message += "State: " + req.body.state + "\n"
    message += "City: " + req.body.city + "\n"
    message += "Zip code: " + req.body.zip + "\n"
    message += "Address: " + req.body.address + "\n"

    for (let i = 0; i < req.body.items.length; i++) {
        message += "product: " + req.body.items[i].itemName + " qty: " + req.body.items[i].nums + "\n"
    }
    console.log(message)
    let mailOptions = {
        // should be replaced with real recipient's account
        to: 'dvgb06reciever@gmail.com',
        subject: "order",
        text: message
        /*password W g!n9)T */
    }
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error)
        }
        console.log('Message %s sent: %s', info.messageId, info.response)
    })
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection succesful')
            for (let i = 0; i < req.body.items.length; i++) {
                mongoose.connection.db.collection("products").updateOne({ "name": req.body.items[i].itemName }, { $inc: { "qty": -req.body.items[i].nums } })
            }
            mongoose.connection.db.collection("orders").find({}, { sort: { orderId: -1 } }).limit(1).toArray((err, data) => {
                let newId = 0
                if (data[0] != null) {
                    newId = parseInt(data[0].postId) + 1
                }
                let newOrder = {
                    orderId: newId,
                    buyersEmail: req.body.email,
                    buyersFirstname: req.body.firstname,
                    buyersLastname: req.body.lastname,
                    country: req.body.country,
                    state: req.body.state,
                    city: req.body.city,
                    zip: req.body.zip,
                    address: req.body.address,
                    items: req.body.items
                }

                mongoose.connection.db.collection("orders").insertOne(newOrder, (err, res) => {
                    if (err) throw err
                    console.log("1 document inserted")
                })
            })
        })
        .catch(err => {
            console.error('Database conection error')
            return res.status(500).send()
        })
    return res.status(301).location("index.html").send({ "message": "Order skickad" })
})

app.get("/order/get/:orderId",cors(), (req, res) => {
    var orderId = parseInt(req.params.orderId)
    mongoose.connect(url, connectionParams)
        .then(() => {
            console.log('Database connection successful')
            mongoose.connection.db.collection("orders").find({ orderId: orderId }).toArray((err, data) => {
                return res.status(200).send(data)
            })
        })
        .catch(err => {
            console.error('Database connection error')
            return res.status(500).send({ "message": "Database connection error" })
        })

})


/*port för anslutning*/
var port = process.env.PORT || 9000

/*Startar servern*/
app.listen(port, () => {
    console.log("Servern är startad på port " + port)
}) 
