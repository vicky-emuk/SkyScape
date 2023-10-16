from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/weather/<string:city>', methods=['GET'])
def get_weather(city):
    return jsonify({
        'city': city,
        'temperature': 20,
        'condition': 'Sunny'
    })

if __name__ == '__main__':
    app.run