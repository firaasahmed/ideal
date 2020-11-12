const { initDatabase } = require('./database.js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function seed() {
    console.log("Starting database seeding...");
    
    // 1. Initialize SQL.js and Database
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'database.sqlite');
    let db;

    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
        // Create table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            brand TEXT,
            category TEXT,
            sku TEXT UNIQUE,
            price REAL,
            quantity INTEGER,
            image_url TEXT
        )`);
    }

    // 2. Clear existing data to avoid duplicates
    db.run("DELETE FROM inventory");

    // 3. Define Seed Data (Sneakers & Bags)
    const items = [
        // SNEAKERS
        ['Air Jordan 1 Retro High', 'Jordan', 'Sneakers', '884411-061', 250.00, 12, 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80'],
        ['Yeezy Boost 350 V2', 'Adidas', 'Sneakers', 'CP9652', 320.00, 8, 'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?auto=format&fit=crop&w=600&q=80'],
        ['Nike Dunk Low Panda', 'Nike', 'Sneakers', 'DD1391-100', 180.00, 25, 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=600&q=80'],
        ['Air Force 1 White', 'Nike', 'Sneakers', '315122-111', 150.00, 40, 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80'],
        ['New Balance 550', 'New Balance', 'Sneakers', 'BB550WT1', 190.00, 15, 'https://images.unsplash.com/photo-1636718282214-0b41408373bb?auto=format&fit=crop&w=600&q=80'],
        
        // LUXURY BAGS
        ['GG Marmont Shoulder Bag', 'Gucci', 'Luxury', '443497', 2800.00, 3, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80'],
        ['Classic Flap Bag', 'Chanel', 'Luxury', 'A01112', 4500.00, 2, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80'],
        ['Prada Re-Edition 2005', 'Prada', 'Luxury', '1BH204', 1850.00, 5, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=600&q=80'],
        ['Birkin 30 Gold', 'Hermes', 'Luxury', 'H030-GLD', 15000.00, 1, 'https://images.unsplash.com/photo-1523779105320-d1ec346ff510?auto=format&fit=crop&w=600&q=80']
    ];

    // 4. Insert Items
    const stmt = db.prepare("INSERT INTO inventory (name, brand, category, sku, price, quantity, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const item of items) {
        stmt.run(item);
    }
    stmt.free();

    // 5. Save and Close
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    
    console.log(`Successfully seeded ${items.length} items into the database.`);
}

seed().catch(err => console.error(err));