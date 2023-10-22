require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const weatherCache = {};
const imageCache = {};
const TTL = 60000; // 1 minute

const getCachedData = (cache, key) => {
  const cacheEntry = cache[key];
  if (!cacheEntry) return null;

  const now = Date.now();
  if (now - cacheEntry.timestamp > TTL) {
    delete cache[key];
    return null;
  }
  
  return cacheEntry.data;
};


app.use(cors());
app.use(express.static(path.resolve(__dirname, '..', 'client')));

const calculateTravelReadiness = (avgTemp, hasRain, pm25Level, avgHumidity, avgWindSpeed) => {
  const weights = {
    avgTemp: 0.3,
    hasRain: 0.2,
    pm25Level: 0.2,
    avgHumidity: 0.15,
    avgWindSpeed: 0.15
  };
  
  // Various scoring calculations
  const tempScore = Math.exp(-Math.pow(avgTemp - 18, 2) / (2 * Math.pow(5, 2))) * 100;
  const rainScore = hasRain ? 50 : 100;
  const airQualityScore = pm25Level <= 50 ? 100 : 100 - (pm25Level - 50) * 0.5;
  const humidityScore = 100 - Math.abs(avgHumidity - 50) * 0.5;
  const windSpeedScore = avgWindSpeed < 10 ? 100 : 100 - (avgWindSpeed - 10) * 2;
  
  // Final score
  return Math.round(
    (tempScore * weights.avgTemp) +
    (rainScore * weights.hasRain) +
    (airQualityScore * weights.pm25Level) +
    (humidityScore * weights.avgHumidity) +
    (windSpeedScore * weights.avgWindSpeed)
  );
};

const roundToOneDecimal = number => parseFloat(number.toFixed(1));

const fetchData = async (url) => {
  const response = await axios.get(url);
  return response.data;
};

const fetchWeatherData = city => fetchData(`http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${WEATHER_API_KEY}`);
const fetchForecastData = city => fetchData(`http://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${WEATHER_API_KEY}`);
const fetchAirPollutionData = (lat, lon) => fetchData(`http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`);

app.get('/weather/:city', async (req, res) => {
  const { city } = req.params;
  const cachedData = getCachedData(weatherCache, city);
  
  if (cachedData) {
    return res.json(cachedData);
  }
  try {
    const weatherData = await fetchWeatherData(city);
    const { lat, lon } = weatherData.coord;

    const [forecastData, airPollutionData] = await Promise.all([
      fetchForecastData(city),
      fetchAirPollutionData(lat, lon)
    ]);

        let hasRain = forecastData.list.some(item => item.weather[0].main === 'Rain');
        let avgTemp = roundToOneDecimal(forecastData.list.reduce((acc, item) => acc + item.main.temp, 0) / forecastData.list.length);
        let pm25Level = roundToOneDecimal(airPollutionData.list.slice(0, 20).reduce((acc, item) => acc + item.components.pm2_5, 0) / 20);
        let avgHumidity = roundToOneDecimal(forecastData.list.reduce((acc, item) => acc + item.main.humidity, 0) / forecastData.list.length);
        let avgWindSpeed = roundToOneDecimal(forecastData.list.reduce((acc, item) => acc + item.wind.speed, 0) / forecastData.list.length);
        let travelReadinessScore = calculateTravelReadiness(avgTemp, hasRain, pm25Level, avgHumidity, avgWindSpeed);

        let fiveDayForecast = {};
        forecastData.list.forEach(item => {
            let date = new Date(item.dt_txt).toLocaleDateString();
            if (!fiveDayForecast[date]) {
                fiveDayForecast[date] = [];
            }
            fiveDayForecast[date].push(item);
        });

        let processedFiveDayForecast = [];
        for (let [date, forecastItems] of Object.entries(fiveDayForecast)) {
            let avgTemp = 0, avgWindSpeed = 0, totalRain = 0;
            forecastItems.forEach(item => {
                avgTemp += item.main.temp;
                avgWindSpeed += item.wind.speed;
                if (item.rain && item.rain['3h']) {
                    totalRain += item.rain['3h'];
                }
            });
            avgTemp /= forecastItems.length;
            avgWindSpeed /= forecastItems.length;

            processedFiveDayForecast.push({
                date: date,
                avgTemp: avgTemp,
                avgWindSpeed: avgWindSpeed,
                totalRain: totalRain,
                icon: forecastItems[0].weather[0].icon
            });
        }

        processedFiveDayForecast = processedFiveDayForecast.map(day => ({
            ...day,
            avgTemp: roundToOneDecimal(day.avgTemp),
            avgWindSpeed: roundToOneDecimal(day.avgWindSpeed),
            totalRain: roundToOneDecimal(day.totalRain)
        }));

        const responseData = {
            city: city,
            temperature: roundToOneDecimal(weatherData.main.temp),
            icon: weatherData.weather[0].icon,
            tempType: avgTemp < 13 ? 'Cold' : (avgTemp <= 23 ? 'Mild' : 'Hot'),
            feelsLike: roundToOneDecimal(weatherData.main.feels_like),
            humidity: roundToOneDecimal(weatherData.main.humidity),
            windSpeed: roundToOneDecimal(weatherData.wind.speed),
            condition: weatherData.weather[0].main,
            packing: hasRain ? 'Bring an umbrella' : 'No umbrella needed',
            travelReadinessScore: travelReadinessScore,
            pm25Level: pm25Level,
            processedFiveDayForecast: processedFiveDayForecast,
            weatherDescription: weatherData.weather[0].description
        };
        weatherCache[city] = { data: responseData, timestamp: Date.now() };
        res.json(responseData);
    } catch (error) {
        res.status(404).json({ error: 'City not found' });
    }
});

const fetchCityImage = async (city) => {
    const placeSearchURL = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${city}&inputtype=textquery&fields=photos&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(placeSearchURL);
    const photoReference = response.data.candidates[0].photos[0].photo_reference;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
  };
  
  app.get('/fetchCityImage', async (req, res) => {
    const { city } = req.query;
    const cachedData = getCachedData(imageCache, city);
  
    if (cachedData) {
        return res.json({ cityImage: cachedData });
    }
    try {
        const cityImage = await fetchCityImage(city);
        imageCache[city] = { data: cityImage, timestamp: Date.now() };
        res.json({ cityImage });
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'City image not found' });
    }
  });
  

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});