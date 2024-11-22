import mysql from 'mysql2';
import dotenv from 'dotenv';
import zod from 'zod';
import express from 'express';
dotenv.config();

const app = express();
app.use(express.json());

const nameSchema = zod.string().min(1).max(255);
const addressSchema = zod.string().min(1).max(255);
const latitudeSchema = zod.number().min(-90).max(90);
const longitudeSchema = zod.number().min(-180).max(180);

const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
}).promise();

// Check for connection Error
pool.getConnection()
    .then((connection) => {
        console.log('Connected to MySQL Database');
        connection.release();
    })
    .catch((err) => {
        console.error('Error connecting to MySQL:', err.message);
    });

// Add School API
app.post('/addSchool', async (req, res) => { 

    const { name, address, latitude, longitude } = req.body;

    // Input Validation
    if (!name || !address || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const nameValidation = nameSchema.safeParse(name);
    if (!nameValidation.success) {
        return res.status(400).json({ error: 'Invalid name.' });
    }

    const addressValidation = addressSchema.safeParse(address);
    if (!addressValidation.success) {
        return res.status(400).json({ error: 'Invalid address.' });
    }
    
    const latitudeValidation = latitudeSchema.safeParse(latitude);
    if (!latitudeValidation.success) {
        return res.status(400).json({ error: 'Invalid latitude.' });
    }
    
    const longitudeValidation = longitudeSchema.safeParse(longitude);
    if (!longitudeValidation.success) {
        return res.status(400).json({ error: 'Invalid longitude.' });
    }
    

    try {
        const [rows] = await pool.query('INSERT INTO school (names, address, latitude, longitude) VALUES (?, ?, ?, ?)', [name, address, latitude, longitude]);
        res.status(201).json({ message: 'School added successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong.' });
    }



});

app.get('/listSchools', async (req, res) => {
    const {latitude,longitude} = req.body;
    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and Longitude are required.' });
    }
    try {
        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        const [results] = await pool.execute('SELECT id, names, address, latitude, longitude FROM school');

        const schools = results.map((school) => {
            const distance = calculateDistance(userLat, userLon, school.latitude, school.longitude);
            return { ...school, distance };
        });

        schools.sort((a, b) => a.distance - b.distance);

        res.status(200).json(schools);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error occurred.' });
    }

});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (degree) => (degree * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));




