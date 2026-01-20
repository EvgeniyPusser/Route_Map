const express = require("express");
const path = require("path");

const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY1MDgyMDUyMTYxZjkzYzFjOTNhNzE5OTYyNDJmZWM5M2RjMjY5MmYyNmU0MGFkNTg5NTliZjM0IiwiaCI6Im11cm11cjY0In0=";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ===== GEOCODE =====
app.get("/geocode", async (req, res) => {
  try {
    const { zip } = req.query;
    if (!zip) return res.status(400).json({ error: "ZIP required" });
    
    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?text=${zip}&boundary.country=US&size=1`,
      { headers: { Authorization: API_KEY } }
    );
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Geocoding failed");
    
    res.json(data);
  } catch (error) {
    console.error("Geocode error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTE =====
app.post("/route", async (req, res) => {
  try {
    const { from, to } = req.body;
    console.log("Route request from:", from, "to:", to);
    
    if (!from || !to) return res.status(400).json({ error: "from/to required" });
    
    // Use POST request to geojson endpoint as per documentation
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    console.log("Making POST request to ORS:", url);
    
    const requestBody = {
      coordinates: [from, to]
    };
    console.log("Request body:", JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_KEY,
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("Route API response status:", response.status);
    
    const data = await response.json();
    console.log("Route data structure:", JSON.stringify(data).substring(0, 300) + "...");
    
    if (!response.ok) throw new Error(data.error?.message || "Routing failed");
    
    res.json(data);
  } catch (error) {
    console.error("Route error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== EXPORT ROADS =====
app.post("/export", async (req, res) => {
  try {
    const { bbox } = req.body;
    console.log("Export request received with bbox:", bbox);
    
    if (!bbox) return res.status(400).json({ error: "bbox required" });
    
    console.log("Making request to OpenRouteService API...");
    
    const response = await fetch(
      "https://api.openrouteservice.org/v2/export/driving-car",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
          Authorization: API_KEY,
        },
        body: JSON.stringify({ bbox }),
      }
    );
    
    console.log("OpenRouteService response status:", response.status);
    
    const data = await response.json();
    console.log("OpenRouteService response data:", JSON.stringify(data).substring(0, 200) + "...");
    
    if (!response.ok) {
      console.error("API Error:", data);
      throw new Error(data.error?.message || `API returned ${response.status}: ${JSON.stringify(data)}`);
    }
    
    console.log("Export successful, sending response");
    res.json(data);
  } catch (error) {
    console.error("Export error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});