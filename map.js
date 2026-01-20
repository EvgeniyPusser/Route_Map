// ===== MAP INIT =====
const map = L.map("map").setView([39.5, -98.35], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let routeLayer, startMarker, endMarker;

function setMsg(text) {
  document.getElementById("msg").textContent = text;
}

// ===== MAIN FUNCTION =====
async function findRoute() {
  console.log("findRoute() called");
  
  const fromZip = document.getElementById("from").value.trim();
  const toZip = document.getElementById("to").value.trim();
  
  console.log("ZIP codes:", fromZip, toZip);
  
  if (!fromZip || !toZip) {
    setMsg("Please enter both ZIP codes");
    return;
  }
  
  try {
    setMsg("Finding route...");
    console.log("Starting geocoding...");
    
    // Get coordinates for both ZIP codes
    const fromCoords = await geocodeZip(fromZip);
    console.log("From coords:", fromCoords);
    
    const toCoords = await geocodeZip(toZip);
    console.log("To coords:", toCoords);
    
    // Get route
    console.log("Getting route...");
    const routeData = await getRoute(fromCoords, toCoords);
    console.log("Route data:", routeData);
    console.log("Route data type:", typeof routeData);
    console.log("Route data keys:", Object.keys(routeData));
    
    // Draw on map
    drawRoute(routeData, fromCoords, toCoords);
    
    const distance = (routeData.features[0].properties.segments[0].distance / 1000).toFixed(1);
    const duration = Math.round(routeData.features[0].properties.segments[0].duration / 60);
    
    setMsg(`Route found: ${distance} km, ${duration} min`);
    
  } catch (error) {
    console.error("Error:", error);
    setMsg("Error: " + error.message);
  }
}

// ===== GEOCODE =====
async function geocodeZip(zip) {
  const response = await fetch(`http://localhost:3000/geocode?zip=${zip}`);
  if (!response.ok) throw new Error("Geocoding failed");
  
  const data = await response.json();
  if (!data.features || !data.features[0]) {
    throw new Error(`ZIP code not found: ${zip}`);
  }
  
  return data.features[0].geometry.coordinates; // [lon, lat]
}

// ===== ROUTE =====
async function getRoute(from, to) {
  const response = await fetch("http://localhost:3000/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Server error response:", errorText);
    throw new Error("Routing failed: " + errorText);
  }
  
  return response.json();
}

// ===== DRAW =====
function drawRoute(routeData, fromCoords, toCoords) {
  console.log("Drawing route with data:", routeData);
  console.log("Data keys:", Object.keys(routeData));
  
  // Clear previous
  if (routeLayer) map.removeLayer(routeLayer);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  
  let coordinates = [];
  
  // Handle different possible data formats
  if (routeData.features && routeData.features[0] && routeData.features[0].geometry && routeData.features[0].geometry.coordinates) {
    // GeoJSON format
    console.log("Using GeoJSON format");
    coordinates = routeData.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
  } else if (routeData.geometry && routeData.geometry.coordinates) {
    // Direct geometry format
    console.log("Using direct geometry format");
    coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
  } else {
    console.error("Unknown route data format:", routeData);
    console.log("Available properties:", Object.keys(routeData));
    if (routeData.features) console.log("Features:", routeData.features);
    if (routeData.routes) {
      console.log("Routes:", routeData.routes);
      console.log("First route:", routeData.routes[0]);
      console.log("First route keys:", Object.keys(routeData.routes[0]));
      if (routeData.routes[0].geometry) {
        console.log("Route geometry type:", typeof routeData.routes[0].geometry);
        console.log("Route geometry:", routeData.routes[0].geometry);
      }
    }
    throw new Error("Cannot find route coordinates in response data");
  }
  
  console.log("Coordinates found:", coordinates.length, "points");
  
  if (coordinates.length === 0) {
    throw new Error("No route coordinates found");
  }
  
  // Draw route as polyline
  routeLayer = L.polyline(coordinates, {
    color: "#0066cc", 
    weight: 5
  }).addTo(map);
  
  // Add markers
  startMarker = L.marker([fromCoords[1], fromCoords[0]], {
    title: "Start"
  }).addTo(map);
  
  endMarker = L.marker([toCoords[1], toCoords[0]], {
    title: "End"
  }).addTo(map);
  
  // Fit bounds
  map.fitBounds(routeLayer.getBounds().pad(0.1));
}

// ===== CLEAR =====
function clearMap() {
  if (routeLayer) map.removeLayer(routeLayer);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  
  map.setView([39.5, -98.35], 4);
  setMsg("Map cleared");
}

// ===== EXPORT ROADS =====
async function exportRoads() {
  try {
    setMsg("Exporting roads from current view...");
    
    // Test bbox (same as your curl command)
    const bbox = [[8.681495,49.41461],[8.686507,49.41943]];
    
    console.log("Sending export request to server...");
    
    const response = await fetch("http://localhost:3000/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox }),
    });
    
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Export error:", error);
      throw new Error("Export failed: " + error);
    }
    
    const data = await response.json();
    console.log("Export data received:", data);
    
    // Handle nodes data from export API
    if (data.nodes && data.nodes.length > 0) {
      // Draw nodes as markers
      data.nodes.forEach(node => {
        const [lng, lat] = node.location;
        L.circleMarker([lat, lng], {
          color: 'green',
          radius: 3,
          fillOpacity: 0.8
        }).addTo(map).bindPopup(`Node ID: ${node.nodeId}<br>Lat: ${lat}, Lng: ${lng}`);
      });
      
      setMsg(`Export complete! Found ${data.nodes.length} nodes`);
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roads_export_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
    } else if (data.features && data.features.length > 0) {
      // Handle GeoJSON features (if API returns different format)
      data.features.forEach(feature => {
        if (feature.geometry.type === 'LineString') {
          const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          L.polyline(coordinates, {
            color: 'green',
            weight: 2,
            opacity: 0.7
          }).addTo(map).bindPopup(`Road: ${feature.properties.name || 'Unnamed'}`);
        }
      });
      setMsg(`Export complete! Found ${data.features.length} roads`);
    } else {
      setMsg("No data found in export response");
      console.log("Unknown data format:", data);
    }
    
  } catch (error) {
    console.error("Export error:", error);
    setMsg("Export error: " + error.message);
  }
}
