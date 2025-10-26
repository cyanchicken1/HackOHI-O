# gOSU
Smart Transit Assistant

A smart transit app for The Ohio State University that finds the fastest bus route from A to B, powered by live API data.

The Problem

For students, faculty, and visitors, the existing campus bus system is hard to navigate. It requires too much time and thinking: you have to find your building, find the nearest stop, find the right bus, check the live map, and then guess if it's faster than just walking. The real user need isn't "Where is the bus?" — it's "What is the fastest way to get to my destination right now?"

Our Solution

Buckeye Routes is a personal transit assistant that does the thinking for you. Instead of just showing you dots on a map, our app:

Takes your start and end location.

Runs a smart algorithm using live bus ETAs.

Calculates the single fastest, end-to-end trip, including all walk, wait, and ride times.

Compares this to the total walk time, so you always know the best option.

Key Features

Live Bus Tracking: Fetches live bus locations from the OSU API every 15 seconds.

End-to-End Route Planning: Find the fastest path from your "Current Location" or any campus building to another.

Smart Routing Algorithm: Calculates the total trip time by adding four parts:

Walk-to-Stop Time

Wait-for-Bus Time (from live ETA)

Bus-Ride Time

Walk-from-Stop Time

Instant Walk Time Comparison: Immediately see the total walking time for your trip.

Real-time Building Search: Search and filter all 200+ OSU campus buildings from a clean UI.

How It Works: The Routing Algorithm

When a user presses "Find Fastest Route," our app's brain (busrouting.js) gets to work.

Run Two Queries: The app immediately runs two calculations at the same time:

Query A (Walk): Calls calculateWalkTime(), which uses the Haversine formula to get the distance in meters, divides it by an average walking speed (1.34 m/s), and saves the totalWalkTime.

Query B (Bus): The main findBestRoute() algorithm begins.

Filter Stops: The algorithm calls findNearbyStops() twice to create two arrays: startStops (all stops within 400m of the start) and endStops (all stops within 400m of the destination).

Find Valid Trips: It enters a nested loop, checking every startStop against every endStop. For a trip to be valid, it must pass two checks:

Same Route: The stops must be on the same bus route.

Correct Direction: It calls isValidDirection(), which checks the route's ordered stop list to ensure the endIndex comes after the startIndex. This is how we solve the "direction" problem.

Get Live ETAs: For every valid trip, it calls findNextBus(), which scans our live bus data (refreshed every 15s) to find the shortest, non-negative timeToArrivalInSeconds for a bus at that stop.

Calculate Total Time: It then calculates the busTravelTime (using live prediction data if possible) and adds all four parts: walkToStopTime + busWaitTime (the live ETA) + busTravelTime + walkFromStopTime.

Find the Winner: After checking all possible trips, the algorithm sorts the final list by totalTime and returns the single bestTrip object. This object is saved to state, which instantly updates the UI to show the user the winning route.

Tech Stack

Core: React Native, JavaScript (ES6+)

Live Data: Official OSU Bus API

Map & UI: react-native-maps, React Native components

Data Processing: Custom-built script to parse GeoJSON building polygons into single-point coordinates.

Collaboration: VS Code Live Share, Git/GitHub

🚀 Getting Started

Prerequisites

Node.js & npm

React Native CLI (npm install -g react-native-cli)

Xcode (for iOS) or Android Studio (for Android)

Installation & Running

Clone the repo:

git clone [https://github.com/](https://github.com/)[YourUsername]/BuckeyeRoutes.git
cd BuckeyeRoutes


Install dependencies:

npm install


Run on iOS:

npx react-native run-ios


Run on Android:

npx react-native run-android


A Note on Data

The buildings.json file in /assets/data was generated from a raw GeoJSON file provided by OSU. A custom script (/scripts/processGeoJSON.js) was written to parse the complex building polygons and calculate their center points. This script does not need to be run unless the source data changes.

🔮 Future Work

This app is a strong foundation. Our vision for scaling includes:

10x People (Technical Scale): Move the routing algorithm to a serverless cloud function. This allows the server to poll the OSU API once, caching the data. Users' apps just send coordinates and get an answer, making the app lighter, faster, and more scalable.

10x Big (Feature Scale): Integrate COTA, scooter, and bike-share APIs. Our algorithm is transport-agnostic and can easily compare bestBusTime vs. bestScooterTime.

10x Impact (Social Scale): Add safety and accessibility features like "Share My ETA," a "Well-Lit Routes" mode for walking at night, and a "Wheelchair Accessible" filter.

👥 Authors

Nico Dunlap
Luke Butcher
Nicholas Hubbard
Lohith Katari

📄 License

This project is licensed under the MIT License.
