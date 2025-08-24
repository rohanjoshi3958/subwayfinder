# Subway Finder - Interactive Map with MBTA Integration

A React.js application that displays an interactive map using Leaflet, automatically detects your current location, and finds nearby MBTA subway stations using the [MBTA API](https://api-v3.mbta.com/docs/swagger/index.html#/).

## Features

- 🌍 Interactive map powered by Leaflet and OpenStreetMap
- 📍 Automatic geolocation detection
- 🎯 Pin marker showing your current location
- 🚇 **NEW: MBTA Station Integration** - Find nearby subway stations
- 📍 **NEW: Moveable Pin** - Click anywhere to move the pin and find stations
- 📱 Responsive design that works on desktop and mobile
- ⚡ Real-time location updates
- 🛡️ Error handling for location services
- 📊 **NEW: Station Information Panel** - Shows distance in miles, accessibility, and station details

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start the development server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Allow location access when prompted by your browser

4. Click "Show Nearby Stations" to find MBTA stations near your location

### How It Works

- The application uses the browser's Geolocation API to get your current position
- If location access is granted, a pin will be placed on the map at your coordinates
- If location access is denied or unavailable, the map will default to Boston
- **Click anywhere on the map** to move the pin to a new location
- **Click "Show Nearby Stations"** to find MBTA subway stations within 1.25 miles of the pinned location
- **Station markers** appear on the map with distance information in miles and accessibility details
- **Station sidebar** shows a list of nearby stations with distances and features

## MBTA API Integration

This application integrates with the [MBTA API v3](https://api-v3.mbta.com/docs/swagger/index.html#/) to provide:

- **Real-time station data** from the MBTA system
- **Distance calculations** using the Haversine formula (displayed in miles)
- **Station filtering** by proximity (1.25 miles radius)
- **Accessibility information** for wheelchair access
- **Station details** including names and coordinates

### API Endpoints Used

- `GET /stops` - Retrieves all MBTA stops with route information
- Filtered by route types 0 (light rail) and 1 (heavy rail)
- Includes route relationships for additional station details

## Technologies Used

- **React.js** - Frontend framework
- **Leaflet** - Interactive maps library
- **react-leaflet** - React wrapper for Leaflet
- **Geolocation API** - Browser API for location detection
- **OpenStreetMap** - Free map tiles
- **MBTA API v3** - Massachusetts Bay Transportation Authority API
- **Haversine Formula** - Distance calculation between coordinates (converted to miles)

## Browser Compatibility

This application works best in modern browsers that support:
- Geolocation API
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Fetch API for HTTP requests

## Troubleshooting

### Location Not Working?
- Make sure you've allowed location access in your browser
- Check that your device has GPS enabled (for mobile devices)
- Try refreshing the page and allowing location access again

### Map Not Loading?
- Check your internet connection
- Ensure you're running the latest version of a modern browser

### Stations Not Loading?
- Verify your internet connection
- Check if the MBTA API is accessible
- Try moving the pin to a different location in the Boston area
- The app searches within a 1.25 miles radius of the pinned location

### No Stations Found?
- The app only shows stations within 1.25 miles of your location
- Try moving the pin closer to Boston or other MBTA service areas
- The app works best in the Greater Boston area where MBTA service is available

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## License

This project is open source and available under the MIT License.

## Data Sources

- **MBTA API**: [https://api-v3.mbta.com/docs/swagger/index.html#/](https://api-v3.mbta.com/docs/swagger/index.html#/)
- **OpenStreetMap**: [https://www.openstreetmap.org/](https://www.openstreetmap.org/)
