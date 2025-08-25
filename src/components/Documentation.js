import React from 'react';
import './Documentation.css';

const Documentation = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="documentation-overlay" onClick={onClose}>
      <div className="documentation-modal" onClick={(e) => e.stopPropagation()}>
        <button className="documentation-close" onClick={onClose}>
          ×
        </button>
        
        <div className="documentation-content">
          <h1>MBTA Subway Finder - Technical Documentation</h1>
          
          <section>
            <h2>Project Overview</h2>
            <p>
              This project is a map application that identifies the three closest MBTA (Massachusetts Bay Transportation Authority) subway stations 
              within a 1.25-mile radius of a specified location.
            </p>
          </section>

          <section>
            <h2>Features</h2>
            <div className="feature-list">
              <div><strong>Interactive Map:</strong> Powered by Leaflet and OpenStreetMap</div>
              <div><strong>Pin Marker:</strong> Shows both current location and user-desired location</div>
              <div><strong>Moveable Pin:</strong> Click anywhere to find the closest subway stations</div>
              <div><strong>Auto-location:</strong> Pin automatically adjusts to user's current location</div>
              <div><strong>Station Information Panel:</strong> Displays distance in miles from the pin, subway lines present at the station, handicap accessibility information, and hideable panel interface</div>
            </div>
          </section>

          <section>
            <h2>Getting Started</h2>
            <div className="step-list">
              <div><strong>Step 1:</strong> Allow location access when prompted by your browser. Your current location will be automatically detected and marked with a pin on the ma</div>
              <div><strong>Step 2:</strong> Click anywhere on the map to move the pin to a different location</div>
              <div><strong>Step 3:</strong> Click "Show Nearby Stations" to find MBTA subway stations within 1.25 miles of the pinned location</div>
              <div><strong>Step 4:</strong> View station information including distance, subway lines, and accessibility features</div>
            </div>
            <p><strong>Note:</strong> The application works best in the Greater Boston area where MBTA subway service is available.</p>
          </section>

          <section>
            <h2>Technologies Used</h2>
            <div className="tech-list">
              <div><strong>React.js:</strong> Framework for the front-end</div>
              <div><strong>React-leaflet:</strong> React wrapper for Leaflet, an interactive maps library</div>
              <div><strong>Geolocation API:</strong> Browser API for location detection</div>
              <div><strong>OpenStreetMap:</strong> Free map tiles used for the application</div>
              <div><strong>MBTA API v3:</strong> Used to get station information</div>
            </div>
          </section>

          <section>
            <h2>API Endpoints</h2>
            <h3>Primary Endpoint: <code>GET /stops</code></h3>
            <p><strong>URL:</strong> <code>https://api-v3.mbta.com/stops</code></p>
            <p>This endpoint retrieves all MBTA stops with route and accessibility information.</p>

            <h4>Parameters Used:</h4>
            <div className="param-list">
              <div><code>filter[route_type]</code>: <code>0,1</code> - Filters for subway stations only</div>
              <div className="param-sub">• <code>0</code> = Light rail (Green Line)</div>
              <div className="param-sub">• <code>1</code> = Heavy rail (Red, Orange, Blue Lines)</div>
              <div><code>include</code>: <code>route</code> - Includes route relationship data</div>
              <div><code>fields[stop]</code>: <code>name,latitude,longitude,wheelchair_boarding</code> - Specifies which stop fields to return</div>
              <div><code>fields[route]</code>: <code>long_name,short_name,route_type</code> - Specifies which route fields to return</div>
            </div>

            <h4>Response Structure:</h4>
            <div className="json-example">
              <pre><code>{`{
  "data": [
    {
      "id": "stop_id",
      "type": "stop",
      "attributes": {
        "name": "Station Name",
        "latitude": 42.123456,
        "longitude": -71.123456,
        "wheelchair_boarding": 1
      },
      "relationships": {
        "route": {
          "data": {
            "id": "route_id",
            "type": "route"
          }
        }
      }
    }
  ],
  "included": [
    {
      "id": "route_id",
      "type": "route",
      "attributes": {
        "long_name": "Red Line",
        "short_name": "Red",
        "route_type": 1
      }
    }
  ]
}`}</code></pre>
            </div>

            <h4>Data Processing:</h4>
            <div className="processing-list">
              <div><strong>Distance Calculation:</strong> Uses Haversine formula to calculate distance from user's location to each station</div>
              <div><strong>Filtering:</strong> Only stations within 1.25 miles of the user's location are displayed</div>
              <div><strong>Caching:</strong> API responses are cached to reduce repeated requests and improve performance</div>
              <div><strong>Rate Limiting:</strong> Caching was implemented to minimize API calls due to the MBTA API's rate limits</div>
            </div>
          </section>

          <section>
            <h2>Data Sources</h2>
            <div className="source-list">
              <div><strong>MBTA API:</strong> <a href="https://api-v3.mbta.com/docs/swagger/index.html" target="_blank" rel="noopener noreferrer">https://api-v3.mbta.com/docs/swagger/index.html</a></div>
              <div><strong>OpenStreetMap:</strong> <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">https://www.openstreetmap.org</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
