require('dotenv').config();

module.exports = {
  expo: {
    name: "gOSU",
    slug: "gosu",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#BB0000"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.lbutch18.gosu",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || ""
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#a7a8aa"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "ab7bd5a5-f80a-4ec7-b075-01d3b1d13932"
      }
    },
    owner: "lbutch18"
  }
};

