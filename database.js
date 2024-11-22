import pkg from 'pg';
const { Pool } = pkg;  
import dotenv from 'dotenv';
import zod from 'zod';
import express from 'express';
import fs from 'fs';
dotenv.config();

const app = express();
app.use(express.json());

const nameSchema = zod.string().min(1).max(255);
const addressSchema = zod.string().min(1).max(255);
const latitudeSchema = zod.number().min(-90).max(90);
const longitudeSchema = zod.number().min(-180).max(180);


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,  
    ssl: {
        rejectUnauthorized: false 
    }
});
const schema = fs.readFileSync('./schema.sql', 'utf8');

pool.query(schema)
  .then(() => {
    console.log('Schema initialized successfully');
  })
  .catch((err) => {
    console.error('Error initializing schema:', err.message);
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
        const query = `
            INSERT INTO schools (name, address, latitude, longitude)
            VALUES ($1, $2, $3, $4)`;
        await pool.query(query, [name, address, latitude, longitude]);
        res.status(201).json({ message: 'School added successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// List Schools API
app.get('/listSchools', async (req, res) => {
    const { latitude, longitude } = req.query;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and Longitude are required.' });
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
        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        
        const result = await pool.query('SELECT id, name, address, latitude, longitude FROM schools');

        const schools = result.rows.map((school) => {
            const distance = calculateDistance(userLat, userLon, school.latitude, school.longitude);
            return { ...school, distance };
        });

        // Sort by distance
        schools.sort((a, b) => a.distance - b.distance);

        res.status(200).json(schools);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error occurred.' });
    }
});

// Calculate Distance function
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
