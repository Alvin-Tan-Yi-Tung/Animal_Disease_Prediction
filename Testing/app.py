from flask import Flask, render_template, jsonify
import csv
import os
import random
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Load data from CSV
def load_data():
    actual_data = []
    csv_path = os.path.join('data', 'wahis_outbreak_details.csv')
    
    # Add encoding parameter to handle special characters
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Add error handling for lat/long parsing
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
                
            # Format dates
            row['start_date'] = row['start_date'] if row['start_date'] != '-' else None
            row['end_date'] = row['end_date'] if row['end_date'] != '-' else None
            
            actual_data.append(row)
    
    return actual_data

# Generate prediction data based on actual data
def generate_prediction_data(actual_data):
    prediction_data = []
    
    for row in actual_data:
        prediction_row = row.copy()
        
        # Simulate prediction by shifting dates 30-90 days forward
        date_format = "%Y/%m/%d"
        
        if prediction_row['start_date']:
            start_date = datetime.strptime(prediction_row['start_date'], date_format)
            start_date += timedelta(days=random.randint(30, 90))
            prediction_row['start_date'] = start_date.strftime(date_format)
        
        if prediction_row['end_date']:
            end_date = datetime.strptime(prediction_row['end_date'], date_format)
            end_date += timedelta(days=random.randint(30, 90))
            prediction_row['end_date'] = end_date.strftime(date_format)
        
        # Slightly adjust location for visualization
        if prediction_row['lat'] and prediction_row['lon']:
            prediction_row['lat'] += random.uniform(-0.5, 0.5)
            prediction_row['lon'] += random.uniform(-0.5, 0.5)
        
        # Modify cases/deaths for simulation
        if prediction_row['cases'] != '-':
            cases = int(prediction_row['cases']) if prediction_row['cases'] else 0
            prediction_row['cases'] = str(max(0, cases + random.randint(-1, 3)))
        
        if prediction_row['deaths'] != '-':
            deaths = int(prediction_row['deaths']) if prediction_row['deaths'] else 0
            prediction_row['deaths'] = str(max(0, deaths + random.randint(-1, 2)))
        
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
        
        # Add type information
        for row in actual_data:
            row['type'] = 'actual'
        
        return jsonify({
            'actual': actual_data,
            'prediction': prediction_data
        })
    except Exception as e:
        print(f"Error in get_data: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)