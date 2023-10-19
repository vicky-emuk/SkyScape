import requests
from flask import Flask, jsonify
from flask_cors import CORS
from collections import defaultdict

app = Flask(__name__)
CORS(app)

@app.route('/weather/<string:city>', methods=['GET'])
def get_weather(city):
    api_key = "7bbaf07775c0d58396c0b093db4ac865"
    base_url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&units=metric&appid={api_key}"
    forecast_url = f"http://api.openweathermap.org/data/2.5/forecast?q={city}&units=metric&appid={api_key}"
    daily_temps = defaultdict(list)
    forecast_response = requests.get(forecast_url)
    forecast_data = forecast_response.json()
    response = requests.get(base_url)
    data = response.json()

    has_rain = any(weather['weather'][0]['main'] == 'Rain' for weather in forecast_data['list'])
    avg_temp = sum(weather['main']['temp'] for weather in forecast_data['list']) / len(forecast_data['list'])
    lat, lon = data['coord']['lat'], data['coord']['lon']

    packing = 'Bring an umbrella' if has_rain else 'No umbrella needed'
    temp_type = 'Cold' if avg_temp < 13 else 'Mild' if avg_temp <= 23 else 'Hot'

    air_pollution_url = f"http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={api_key}"
    air_pollution_response = requests.get(air_pollution_url)
    air_pollution_data = air_pollution_response.json()
    pm25_level = sum(item['components']['pm2_5'] for item in air_pollution_data['list'][:20]) / 20
    travel_readiness_score = calculate_travel_readiness(avg_temp, has_rain, pm25_level)

    for weather in forecast_data['list']:
        date = weather['dt_txt'][:10]
        daily_temps[date].append(weather['main']['temp'])
    
    for date, temps in daily_temps.items():
        daily_temps[date] = sum(temps) / len(temps)

    if data["cod"] != "404":
        weather_data = {
            'city': city,
            'temperature': data['main']['temp'],
            'temp_type': temp_type,
            'condition': data['weather'][0]['main'],
            'packing': packing,
            'forecast': forecast_data['list'],
            'daily_forecast': dict(daily_temps),
            'travel_readiness_score': travel_readiness_score,
            'pm25_level': pm25_level
        }
        return jsonify(weather_data)
    else:
        return jsonify({'error': 'City not found'}), 404
    
def calculate_travel_readiness(avg_temp, has_rain, pm25_level):
    score = 0
    if 13 <= avg_temp <= 23:
        score += 40
    elif avg_temp > 23:
        score += 20
    if not has_rain:
        score += 30
    if pm25_level <= 10:
        score += 30
    return score

if __name__ == '__main__':
    app.run