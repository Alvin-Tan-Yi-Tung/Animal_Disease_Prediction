# app.py
import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

from flask import Flask, render_template, jsonify, request
import csv
import os
import random
from datetime import datetime, timedelta
import numpy as np

# Import the predictor
from data.model_integration import predictor

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Store predictions in memory (in a real app, use a database)
predictions_cache = {}

def load_data():
    actual_data = []
    csv_path = os.path.join('data', 'wahis_outbreak_details.csv')
    
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    if row['lat_long'] and row['lat_long'] != '-':
                        lat, lon = row['lat_long'].split(',')
                        row['lat'] = float(lat.strip())
                        row['lon'] = float(lon.strip())
                    else:
                        row['lat'] = None
                        row['lon'] = None
                except Exception as e:
                    print(f"Error parsing coordinates: {e}")
                    row['lat'] = None
                    row['lon'] = None
                    
                row['start_date'] = row['start_date'] if row['start_date'] != '-' else None
                row['end_date'] = row['end_date'] if row['end_date'] != '-' else None
                
                actual_data.append(row)
    except Exception as e:
        print(f"Error loading data: {e}")
        # Return some sample data if the file doesn't exist
        actual_data = [
            {
                'country': 'United States',
                'location': 'California',
                'start_date': '2023/06/01',
                'end_date': '2023/06/15',
                'cases': '450',
                'deaths': '45',
                'lat': 37.09,
                'lon': -95.71
            },
            {
                'country': 'Brazil',
                'location': 'Amazonas',
                'start_date': '2023/07/10',
                'end_date': '2023/07/25',
                'cases': '380',
                'deaths': '38',
                'lat': -14.24,
                'lon': -51.93
            },
            {
                'country': 'India',
                'location': 'Mumbai',
                'start_date': '2023/09/05',
                'end_date': '2023/09/20',
                'cases': '620',
                'deaths': '62',
                'lat': 20.59,
                'lon': 78.96
            },
            {
                'country': 'Australia',
                'location': 'Outback',
                'start_date': '2023/05/15',
                'end_date': '2023/05/30',
                'cases': '290',
                'deaths': '29',
                'lat': -25.27,
                'lon': 133.78
            },
            {
                'country': 'South Africa',
                'location': 'Northern Cape',
                'start_date': '2023/08/01',
                'end_date': '2023/08/15',
                'cases': '460',
                'deaths': '46',
                'lat': -30.56,
                'lon': 22.94
            }
        ]
    
    return actual_data

def generate_prediction_data(actual_data):
    prediction_data = []
    
    # Check if we have any predictions in cache
    if not predictions_cache:
        return prediction_data
    
    # Country center coordinates (approximate)
    country_centers = {
        'Albania': (41.1533, 20.1683),
        'Argentina': (-38.4161, -63.6167),
        'Armenia': (40.0691, 45.0382),
        'Bangladesh': (23.6850, 90.3563),
        'Belgium': (50.5039, 4.4699),
        'Bhutan': (27.5142, 90.4336),
        'Bosnia and Herzegovina': (43.9159, 17.6791),
        'Burkina Faso': (12.2383, -1.5616),
        'Cambodia': (12.5657, 104.9910),
        'Canada': (56.1304, -106.3468),
        'Ceuta': (35.8883, -5.3162),
        'Chile': (-35.6751, -71.5429),
        'Chinese Taipei': (23.6978, 120.9605),
        'Congo (Rep. of the)': (-0.2280, 15.8277),
        'Ecuador': (-1.8312, -78.1834),
        'Egypt': (26.8206, 30.8025),
        'El Salvador': (13.7942, -88.8965),
        'Finland': (61.9241, 25.7482),
        'France': (46.6034, 1.8883),
        'French Guiana': (3.9339, -53.1258),
        'Germany': (51.1657, 10.4515),
        'Greece': (39.0742, 21.8243),
        'Honduras': (15.2000, -86.2419),
        'Hungary': (47.1625, 19.5033),
        'Indonesia': (-0.7893, 113.9213),
        'Italy': (41.8719, 12.5674),
        'Kazakhstan': (48.0196, 66.9237),
        'Liberia': (6.4281, -9.4295),
        'Libya': (26.3351, 17.2283),
        'Lithuania': (55.1694, 23.8813),
        'Malaysia': (4.2105, 101.9758),
        'Melilla': (35.2939, -2.9383),
        'Moldova': (47.4116, 28.3699),
        'Myanmar': (21.9162, 95.9560),
        'Namibia': (-22.9576, 18.4904),
        'Netherlands': (52.1326, 5.2913),
        'Nigeria': (9.0820, 8.6753),
        'North Macedonia': (41.6086, 21.7453),
        'Norway': (60.4720, 8.4689),
        'Palestine': (31.9522, 35.2332),
        'Slovakia': (48.6690, 19.6990),
        'South Africa': (-30.5595, 22.9375),
        'Spain': (40.4637, -3.7492),
        'Sweden': (60.1282, 18.6435),
        'Thailand': (15.8700, 100.9925),
        'Timor-Leste': (-8.8742, 125.7275),
        'United States of America': (37.0902, -95.7129),
        'Uruguay': (-32.5228, -55.7658),
        # Add some common countries that might be in the data
        'United States': (37.0902, -95.7129),
        'Brazil': (-14.235, -51.9253),
        'India': (20.5937, 78.9629),
        'Australia': (-25.2744, 133.7751),
        'South Africa': (-30.5595, 22.9375)
    }
    
    # Convert cached predictions to the format expected by the frontend
    for prediction_key, prediction_value in predictions_cache.items():
        # Parse the prediction key (format: country_interval_date)
        parts = prediction_key.split('_')
        if len(parts) < 3:
            continue
            
        country = parts[0]
        interval = parts[1]
        date_str = '_'.join(parts[2:])
        
        # For "all" countries prediction, create markers for each country
        if country == 'all':
            for country_name, coords in country_centers.items():
                template = {
                    'country': country_name,
                    'location': f'Predicted Outbreak in {country_name}',
                    'start_date': date_str,
                    'end_date': None,
                    'cases': str(prediction_value),
                    'deaths': str(max(1, prediction_value // 10)),
                    'lat': coords[0],
                    'lon': coords[1],
                    'type': 'prediction'
                }
                prediction_data.append(template)
        else:
            # For specific country prediction
            if country in country_centers:
                coords = country_centers[country]
                template = {
                    'country': country,
                    'location': f'Predicted Outbreak in {country}',
                    'start_date': date_str,
                    'end_date': None,
                    'cases': str(prediction_value),
                    'deaths': str(max(1, prediction_value // 10)),
                    'lat': coords[0],
                    'lon': coords[1],
                    'type': 'prediction'
                }
                prediction_data.append(template)
            else:
                # Fallback for unknown countries - use a random location
                template = {
                    'country': country,
                    'location': f'Predicted Outbreak in {country}',
                    'start_date': date_str,
                    'end_date': None,
                    'cases': str(prediction_value),
                    'deaths': str(max(1, prediction_value // 10)),
                    'lat': random.uniform(-60, 85),
                    'lon': random.uniform(-180, 180),
                    'type': 'prediction'
                }
                prediction_data.append(template)
    
    return prediction_data

@app.route('/')
def index():
    # Clear predictions when the page is loaded
    predictions_cache.clear()
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    try:
        actual_data = load_data()
        prediction_data = generate_prediction_data(actual_data)
        
        for row in actual_data:
            row['type'] = 'actual'
        
        return jsonify({
            'actual': actual_data,
            'prediction': prediction_data
        })
    except Exception as e:
        print(f"Error in get_data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict_outbreaks():
    try:
        data = request.json
        date_str = data['date']
        interval = data['interval']
        country = data.get('country', 'all')
        
        # Handle both 'annual' and 'annually' for backward compatibility
        if interval == 'annual':
            interval = 'annually'
            
        if not hasattr(predictor, 'models_loaded') or not predictor.models_loaded:
            return jsonify({"error": "Models not loaded. Please check if the model files exist and are accessible."}), 500
        
        # Clear previous predictions before making a new one
        predictions_cache.clear()
        
        # Make prediction - use the new predict method
        outbreaks_count = predictor.predict(country, interval)
        
        # Store the prediction in cache
        prediction_key = f"{country}_{interval}_{date_str}"
        predictions_cache[prediction_key] = outbreaks_count
        
        return jsonify({
            'status': 'success',
            'date': date_str,
            'predicted_outbreaks': outbreaks_count,
            'country': country
        })
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/predictions')
def get_predictions():
    """Return all cached predictions"""
    return jsonify(predictions_cache)

@app.route('/api/clear_predictions', methods=['POST'])
def clear_predictions():
    """Clear all cached predictions"""
    predictions_cache.clear()
    return jsonify({"status": "success", "message": "Predictions cleared"})

@app.route('/api/has_predictions')
def has_predictions():
    """Check if there are any cached predictions"""
    return jsonify({'has_predictions': len(predictions_cache) > 0})

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)