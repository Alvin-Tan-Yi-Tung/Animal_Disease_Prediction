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
    
    for row in actual_data:
        prediction_row = row.copy()
        
        date_format = "%Y/%m/%d"
        
        if prediction_row['start_date']:
            try:
                start_date = datetime.strptime(prediction_row['start_date'], date_format)
                start_date += timedelta(days=random.randint(30, 90))
                prediction_row['start_date'] = start_date.strftime(date_format)
            except:
                prediction_row['start_date'] = None
        
        if prediction_row['end_date']:
            try:
                end_date = datetime.strptime(prediction_row['end_date'], date_format)
                end_date += timedelta(days=random.randint(30, 90))
                prediction_row['end_date'] = end_date.strftime(date_format)
            except:
                prediction_row['end_date'] = None
        
        if prediction_row.get('lat') and prediction_row.get('lon'):
            prediction_row['lat'] += random.uniform(-0.5, 0.5)
            prediction_row['lon'] += random.uniform(-0.5, 0.5)
        
        if prediction_row.get('cases') and prediction_row['cases'] != '-':
            try:
                cases = int(prediction_row['cases']) if prediction_row['cases'] else 0
                prediction_row['cases'] = str(max(0, cases + random.randint(-1, 3)))
            except:
                prediction_row['cases'] = '0'
        
        if prediction_row.get('deaths') and prediction_row['deaths'] != '-':
            try:
                deaths = int(prediction_row['deaths']) if prediction_row['deaths'] else 0
                prediction_row['deaths'] = str(max(0, deaths + random.randint(-1, 2)))
            except:
                prediction_row['deaths'] = '0'
        
        prediction_row['type'] = 'prediction'
        prediction_data.append(prediction_row)
    
    return prediction_data

@app.route('/')
def index():
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
        
        if not hasattr(predictor, 'models_loaded') or not predictor.models_loaded:
            return jsonify({"error": "Models not loaded. Please check if the model files exist and are accessible."}), 500
        
        if interval == 'weekly':
            outbreaks_count = predictor.predict_weekly(date_str)
        elif interval == 'monthly':
            outbreaks_count = predictor.predict_monthly(date_str)
        elif interval == 'annually':
            outbreaks_count = predictor.predict_annual(date_str)
        else:
            return jsonify({"error": "Invalid interval"}), 400
        
        return jsonify({
            'status': 'success',
            'date': date_str,
            'predicted_outbreaks': outbreaks_count
        })
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)