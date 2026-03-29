const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Create the connection to MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tearsofjoy',   
    database: 'bms_db'
});

db.connect(err => {
    if (err) console.log("Database Connection Error: ", err);
    else console.log("MySQL Connected!");
});

// A simple test route
app.get('/', (req, res) => {
    res.send("BMS Backend is Running");
});

app.listen(5000, () => {
    console.log("Server started on port 5000");
});