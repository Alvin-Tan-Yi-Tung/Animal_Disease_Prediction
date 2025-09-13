# data/model_integration.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
import pickle
import tensorflow as tf
from tensorflow.keras import backend as K
import warnings
from sklearn.exceptions import DataConversionWarning

# Suppress sklearn warnings about feature names
warnings.filterwarnings("ignore", category=DataConversionWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Enable unsafe deserialization to allow loading models with Lambda layers
tf.keras.config.enable_unsafe_deserialization()

# Create custom Lambda layer classes with proper TensorFlow imports
@tf.keras.utils.register_keras_serializable()
class OutbreakSequence(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(OutbreakSequence, self).__init__(**kwargs)
        
    def call(self, inputs):
        # Extract the outbreak count feature (first feature)
        return inputs[..., 0:1]
    
    def get_config(self):
        return super(OutbreakSequence, self).get_config()
    
    def compute_output_shape(self, input_shape):
        return (input_shape[0], input_shape[1], 1)

@tf.keras.utils.register_keras_serializable()
class CountrySequence(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(CountrySequence, self).__init__(**kwargs)
        
    def call(self, inputs):
        # Extract the country ID feature (second feature) and cast to int32
        return tf.cast(inputs[..., 1], dtype='int32')
    
    def get_config(self):
        return super(CountrySequence, self).get_config()
    
    def compute_output_shape(self, input_shape):
        return (input_shape[0], input_shape[1])

@tf.keras.utils.register_keras_serializable()
class DateSequence(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(DateSequence, self).__init__(**kwargs)
        
    def call(self, inputs):
        # Extract the date features (from the 3rd feature onwards)
        return inputs[..., 2:]
    
    def get_config(self):
        return super(DateSequence, self).get_config()
    
    def compute_output_shape(self, input_shape):
        return (input_shape[0], input_shape[1], input_shape[2] - 2)

# Define custom objects for Lambda layers
custom_objects = {
    'OutbreakSequence': OutbreakSequence,
    'CountrySequence': CountrySequence,
    'DateSequence': DateSequence,
}

class OutbreakPredictor:
    def __init__(self):
        self.weekly_model = None
        self.monthly_model = None
        self.weekly_scaler = MinMaxScaler()
        self.monthly_scaler = MinMaxScaler()
        self.raw_data = None
        self.weekly_data = None
        self.monthly_data = None
        self.annual_data = None
        self.weekly_processed = None
        self.monthly_processed = None
        self.annual_processed = None
        self.models_loaded = False
        self.model_metadata = {}
        self.country_encoder = LabelEncoder()
        
        # Define the 48 countries used in training
        self.countries_48 = [
            'Albania', 'Argentina', 'Armenia', 'Bangladesh', 'Belgium', 'Bhutan',
            'Bosnia and Herzegovina', 'Burkina Faso', 'Cambodia', 'Canada', 'Ceuta',
            'Chile', 'Chinese Taipei', 'Congo (Rep. of the)', 'Ecuador', 'Egypt',
            'El Salvador', 'Finland', 'France', 'French Guiana', 'Germany', 'Greece',
            'Honduras', 'Hungary', 'Indonesia', 'Italy', 'Kazakhstan', 'Liberia', 'Libya',
            'Lithuania', 'Malaysia', 'Melilla', 'Moldova', 'Myanmar', 'Namibia',
            'Netherlands', 'Nigeria', 'North Macedonia', 'Norway', 'Palestine', 'Slovakia',
            'South Africa', 'Spain', 'Sweden', 'Thailand', 'Timor-Leste',
            'United States of America', 'Uruguay'
        ]
        self.country_encoder.fit(self.countries_48)
        
        # Store min and max years for normalization
        self.min_year = 2000
        self.max_year = 2023
        
    def load_models(self):
        """Load pre-trained models and prepare data"""
        try:
            # Check if model files exist
            model_files = {
                'weekly': 'models/global_weekly_model.keras',
                'monthly': 'models/global_monthly_model.keras'
            }
            
            # Load available models
            for model_type, model_file in model_files.items():
                if os.path.exists(model_file):
                    try:
                        # Try to load with custom objects
                        model = load_model(
                            model_file, 
                            custom_objects=custom_objects,
                            compile=False
                        )
                        setattr(self, f"{model_type}_model", model)
                        print(f"Loaded {model_type} model with custom objects")
                    except Exception as e:
                        print(f"Error loading {model_type} model with custom objects: {e}")
                        # Try loading without custom objects as fallback
                        try:
                            model = load_model(model_file, compile=False)
                            setattr(self, f"{model_type}_model", model)
                            print(f"Loaded {model_type} model without custom objects")
                        except Exception as e2:
                            print(f"Error loading {model_type} model without custom objects: {e2}")
                            setattr(self, f"{model_type}_model", None)
                else:
                    print(f"Warning: Model file not found: {model_file}")
                    setattr(self, f"{model_type}_model", None)
            
            # Prepare data
            self.prepare_data()
            
            # Check if at least one model was loaded
            if any([self.weekly_model, self.monthly_model]):
                print("Models loaded successfully")
                self.models_loaded = True
                return True
            else:
                print("No models could be loaded, using fallback predictions")
                self.models_loaded = True  # Still mark as loaded to use fallback
                return True
                
        except Exception as e:
            print(f"Error loading models: {e}")
            self.models_loaded = True  # Still mark as loaded to use fallback
            return True
    
    def load_models_with_fallback(self):
        """Try to load models with fallback to simple averaging"""
        try:
            return self.load_models()
        except Exception as e:
            print(f"Error loading models: {e}. Using fallback mode.")
            self.models_loaded = True  # Mark as loaded to use fallback
            self.prepare_data()  # Still prepare data for fallback predictions
            return True
    
    def refresh_data(self):
        """Refresh data from the CSV file"""
        try:
            self.prepare_data()
            print("Data refreshed successfully")
            return True
        except Exception as e:
            print(f"Error refreshing data: {e}")
            return False
    
    def check_country_data_availability(self):
        """Check which countries have sufficient data for prediction"""
        problematic_countries = []
        
        if self.weekly_processed is not None:
            for country in self.countries_48:
                country_data = self.weekly_processed[self.weekly_processed['country'] == country]
                if len(country_data) < 24:
                    problematic_countries.append(f"Weekly: {country} - only {len(country_data)} records")
        
        if self.monthly_processed is not None:
            for country in self.countries_48:
                country_data = self.monthly_processed[self.monthly_processed['country'] == country]
                if len(country_data) < 12:
                    problematic_countries.append(f"Monthly: {country} - only {len(country_data)} records")
        
        if problematic_countries:
            print("Countries with insufficient data:")
            for problem in problematic_countries:
                print(f"  - {problem}")
        else:
            print("All countries have sufficient data for prediction")
        
        return problematic_countries
    
    def predict_for_all_countries(self, interval, target_date):
        """Make predictions for all countries and aggregate results using averages"""
        try:
            # Refresh data to get the latest information
            self.refresh_data()
            
            if interval == 'weekly' and self.weekly_processed is not None and len(self.weekly_processed) > 0:
                return max(1, round(self.weekly_processed['outbreak_count'].mean()))
            elif interval == 'monthly' and self.monthly_processed is not None and len(self.monthly_processed) > 0:
                return max(1, round(self.monthly_processed['outbreak_count'].mean()))
            else:
                return 1  # Default fallback value
        except Exception as e:
            print(f"Error in predict_for_all_countries: {e}")
            return 1  # Default fallback value
    
    def predict(self, country, interval, target_date=None):
        """
        Main prediction method that routes to the appropriate specific prediction method
        """
        try:
            # Refresh data to get the latest information
            self.refresh_data()
            
            # Handle "all" countries case
            if country == 'all':
                return self.predict_for_all_countries(interval, target_date)
            
            # Set default target date if not provided
            if target_date is None:
                if interval == 'weekly':
                    target_date = datetime.now() + timedelta(days=7)
                elif interval == 'monthly':
                    target_date = datetime.now() + timedelta(days=30)
            
            # Convert target_date to proper format if it's a string
            if isinstance(target_date, str):
                if interval == 'weekly':
                    target_date = pd.to_datetime(target_date)
                elif interval == 'monthly':
                    # For monthly, ensure we have the first day of the month
                    target_date = pd.to_datetime(target_date + '-01' if len(target_date) == 7 else target_date)
            
            # Convert interval to match the method names for single country predictions
            if interval == 'weekly':
                return self.predict_weekly(target_date, country)
            elif interval == 'monthly':
                return self.predict_monthly(target_date, country)
            else:
                raise ValueError(f"Invalid interval: {interval}")
        except Exception as e:
            print(f"Error in predict method: {e}")
            # Fallback: use simple average of recent data
            return self.fallback_prediction(interval, country)
    
    def fallback_prediction(self, interval, country):
        """Fallback prediction using simple averaging"""
        try:
            if interval == 'weekly' and self.weekly_processed is not None and len(self.weekly_processed) > 0:
                if country == 'all':
                    avg_outbreaks = self.weekly_processed['outbreak_count'].mean()
                else:
                    country_data = self.weekly_processed[self.weekly_processed['country'] == country]
                    if len(country_data) > 0:
                        avg_outbreaks = country_data['outbreak_count'].mean()
                    else:
                        avg_outbreaks = 0
                return max(1, round(avg_outbreaks))
            elif interval == 'monthly' and self.monthly_processed is not None and len(self.monthly_processed) > 0:
                if country == 'all':
                    avg_outbreaks = self.monthly_processed['outbreak_count'].mean()
                else:
                    country_data = self.monthly_processed[self.monthly_processed['country'] == country]
                    if len(country_data) > 0:
                        avg_outbreaks = country_data['outbreak_count'].mean()
                    else:
                        avg_outbreaks = 0
                return max(1, round(avg_outbreaks))
            else:
                return 1  # Default fallback value
        except Exception as e:
            print(f"Error in fallback prediction: {e}")
            return 1  # Default fallback value
    
    def prepare_data(self):
        """Prepare the data for prediction by loading and processing the CSV"""
        try:
            # Check if data file exists
            csv_path = 'data/wahis_outbreak_details.csv'
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"Data file not found: {csv_path}")
                
            # Load the original data
            df = pd.read_csv(csv_path)
            self.raw_data = df  # Store raw data for potential future use
            
            # Convert dates and handle missing values
            df['start_date'] = pd.to_datetime(df['start_date'], format='%Y/%m/%d', errors='coerce')
            df['end_date'] = pd.to_datetime(df['end_date'], format='%Y/%m/%d', errors='coerce')
            df['cases'] = pd.to_numeric(df['cases'], errors='coerce').fillna(0)
            df['deaths'] = pd.to_numeric(df['deaths'], errors='coerce').fillna(0)
            
            # Check if we have enough data
            if len(df) < 10:
                raise ValueError("Not enough data for prediction. Need at least 10 records.")
            
            # Filter to only include the 48 countries used in training
            df = df[df['country'].isin(self.countries_48)]
            
            # Update min and max years based on actual data
            if len(df) > 0:
                self.min_year = df['start_date'].dt.year.min()
                self.max_year = df['start_date'].dt.year.max()
            
            # Create time period columns
            df['Year'] = df['start_date'].dt.year
            df['Month'] = df['start_date'].dt.to_period('M')
            df['Week'] = df['start_date'].dt.to_period('W')
            
            # Weekly aggregation
            weekly_df = df.groupby(['Week', 'country'], observed=True).agg(
                outbreak_count=('start_date', 'count')
            ).reset_index()
            
            # Monthly aggregation
            monthly_df = df.groupby(['Month', 'country'], observed=True).agg(
                outbreak_count=('start_date', 'count')
            ).reset_index()
            
            # Store the data
            self.weekly_data = weekly_df
            self.monthly_data = monthly_df
            
            # Create features and fit scalers
            self.prepare_weekly_features()
            self.prepare_monthly_features()
            
            print("Data prepared for prediction")
        except Exception as e:
            print(f"Error preparing data: {e}")
            # Create empty dataframes as fallback
            self.weekly_processed = pd.DataFrame()
            self.monthly_processed = pd.DataFrame()
    
    def prepare_weekly_features(self):
        """Prepare features for weekly prediction and fit scaler"""
        try:
            weekly_agg = self.weekly_data.copy()
            weekly_agg['Week'] = weekly_agg['Week'].astype(str)
            
            # Fixed: Added explicit format to avoid warning
            weekly_agg['Week'] = pd.to_datetime(
                weekly_agg['Week'].str.split('/').str[0], 
                format='%Y-%m-%d'
            )
            
            # Add time features like in training
            weekly_agg['year'] = (weekly_agg['Week'].dt.year - self.min_year) / (self.max_year - self.min_year)
            weekly_agg['month'] = weekly_agg['Week'].dt.month / 12.0
            weekly_agg['week'] = weekly_agg['Week'].dt.isocalendar().week / 52.0
            
            weekly_agg = weekly_agg.sort_values(['country', 'Week'])
            
            # Drop rows with NaN values
            weekly_agg = weekly_agg.dropna()
            
            # Check if we have enough data
            if len(weekly_agg) < 24:
                print("Warning: Not enough weekly data for prediction. Will use fallback methods.")
                self.weekly_processed = weekly_agg
                return
            
            # Fit the scaler on outbreak_count only - use .values to avoid warnings
            self.weekly_scaler.fit(weekly_agg[['outbreak_count']].values)
            
            # Store the processed data
            self.weekly_processed = weekly_agg
            
        except Exception as e:
            print(f"Error preparing weekly features: {e}")
            self.weekly_processed = pd.DataFrame()
    
    def prepare_monthly_features(self):
        """Prepare features for monthly prediction and fit scaler"""
        try:
            monthly_agg = self.monthly_data.copy()
            monthly_agg['Month'] = monthly_agg['Month'].astype(str)
            
            # Fixed: Added explicit format to avoid warning
            monthly_agg['Month'] = pd.to_datetime(
                monthly_agg['Month'].str.split('/').str[0], 
                format='%Y-%m'
            )
            
            # Add time features like in training
            monthly_agg['year'] = (monthly_agg['Month'].dt.year - self.min_year) / (self.max_year - self.min_year)
            monthly_agg['month'] = monthly_agg['Month'].dt.month / 12.0
            monthly_agg['week'] = 0.5  # Default mid-month value
            
            monthly_agg = monthly_agg.sort_values(['country', 'Month'])
            
            # Drop rows with NaN values
            monthly_agg = monthly_agg.dropna()
            
            # Check if we have enough data
            if len(monthly_agg) < 12:
                print("Warning: Not enough monthly data for prediction. Will use fallback methods.")
                self.monthly_processed = monthly_agg
                return
            
            # Fit the scaler on outbreak_count only - use .values to avoid warnings
            self.monthly_scaler.fit(monthly_agg[['outbreak_count']].values)
            
            # Store the processed data
            self.monthly_processed = monthly_agg
            
        except Exception as e:
            print(f"Error preparing monthly features: {e}")
            self.monthly_processed = pd.DataFrame()
    
    def prepare_weekly_input(self, target_date, country):
        """Prepare input for weekly prediction with the correct features (5 features)"""
        try:
            if self.weekly_processed is None or len(self.weekly_processed) == 0:
                raise ValueError("Weekly data not processed. Please load data first.")
                
            # Get the last 24 weeks of processed data for the specific country
            country_data = self.weekly_processed[self.weekly_processed['country'] == country]
            if len(country_data) < 24:
                raise ValueError(f"Not enough data for {country}. Need at least 24 weeks of data.")
                
            last_24_weeks = country_data.iloc[-24:].copy()
            
            # Get the outbreak count values
            outbreak_data = last_24_weeks[['outbreak_count']].values
            
            # Scale the features - reshape to match the expected format
            scaled_features = self.weekly_scaler.transform(outbreak_data.reshape(-1, 1))
            
            # Get country ID
            country_id = self.country_encoder.transform([country])[0]
            country_ids = np.full((24, 1), country_id)
            
            # Get time features for the prediction period (target date)
            # Convert target_date to datetime if it's a string
            if isinstance(target_date, str):
                target_date = pd.to_datetime(target_date)
                
            # Calculate time features for the target date
            year = (target_date.year - self.min_year) / (self.max_year - self.min_year)
            month = target_date.month / 12.0
            week = target_date.isocalendar().week / 52.0
            
            # Create time features array (repeated for all 24 timesteps)
            time_features = np.array([[year, month, week]] * 24)
            
            # Combine all features (shape: 24, 5)
            combined_data = np.concatenate([
                scaled_features, 
                country_ids, 
                time_features
            ], axis=1)
            
            # Reshape for LSTM input (samples, timesteps, features)
            return combined_data.reshape(1, 24, 5)
        except Exception as e:
            print(f"Error preparing weekly input for {country}: {e}")
            raise
    
    def prepare_monthly_input(self, target_date, country):
        """Prepare input for monthly prediction with the correct features (5 features)"""
        try:
            if self.monthly_processed is None or len(self.monthly_processed) == 0:
                raise ValueError("Monthly data not processed. Please load data first.")
                
            # Get the last 12 months of processed data for the specific country
            country_data = self.monthly_processed[self.monthly_processed['country'] == country]
            if len(country_data) < 12:
                raise ValueError(f"Not enough data for {country}. Need at least 12 months of data.")
                
            last_12_months = country_data.iloc[-12:].copy()
            
            # Get the outbreak count values
            outbreak_data = last_12_months[['outbreak_count']].values
            
            # Scale the features - reshape to match the expected format
            scaled_features = self.monthly_scaler.transform(outbreak_data.reshape(-1, 1))
            
            # Get country ID
            country_id = self.country_encoder.transform([country])[0]
            country_ids = np.full((12, 1), country_id)
            
            # Get time features for the prediction period (target date)
            # Convert target_date to datetime if it's a string
            if isinstance(target_date, str):
                target_date = pd.to_datetime(target_date)
                
            # Calculate time features for the target date
            year = (target_date.year - self.min_year) / (self.max_year - self.min_year)
            month = target_date.month / 12.0
            week = 0.5  # Default mid-month value
            
            # Create time features array (repeated for all 12 timesteps)
            time_features = np.array([[year, month, week]] * 12)
            
            # Combine all features (shape: 12, 5)
            combined_data = np.concatenate([
                scaled_features, 
                country_ids, 
                time_features
            ], axis=1)
            
            # Reshape for LSTM input (samples, timesteps, features)
            return combined_data.reshape(1, 12, 5)
        except Exception as e:
            print(f"Error preparing monthly input for {country}: {e}")
            raise
    
    def predict_weekly(self, target_date, country):
        """Make a weekly prediction"""
        try:
            # First try to use the model if available
            if self.weekly_model is not None:
                try:
                    input_data = self.prepare_weekly_input(target_date, country)
                    scaled_prediction = self.weekly_model.predict(input_data, verbose=0)
                    
                    # Inverse transform the prediction
                    actual_prediction = self.weekly_scaler.inverse_transform(scaled_prediction.reshape(-1, 1))
                    
                    result = max(0, round(float(actual_prediction[0][0])))
                    return result
                except Exception as e:
                    print(f"Model prediction failed for {country}, using fallback: {e}")
            
            # Fallback: use simple average of recent data
            return self.fallback_prediction('weekly', country)
                
        except Exception as e:
            print(f"Error in weekly prediction for {country}: {e}")
            return self.fallback_prediction('weekly', country)
    
    def predict_monthly(self, target_date, country):
        """Make a monthly prediction"""
        try:
            # First try to use the model if available
            if self.monthly_model is not None:
                try:
                    input_data = self.prepare_monthly_input(target_date, country)
                    scaled_prediction = self.monthly_model.predict(input_data, verbose=0)
                    
                    # Inverse transform the prediction
                    actual_prediction = self.monthly_scaler.inverse_transform(scaled_prediction.reshape(-1, 1))
                    
                    result = max(0, round(float(actual_prediction[0][0])))
                    return result
                except Exception as e:
                    print(f"Model prediction failed for {country}, using fallback: {e}")
            
            # Fallback: use simple average of recent data
            return self.fallback_prediction('monthly', country)
                
        except Exception as e:
            print(f"Error in monthly prediction for {country}: {e}")
            return self.fallback_prediction('monthly', country)

# Initialize the predictor
predictor = OutbreakPredictor()
models_loaded = predictor.load_models_with_fallback()

# Check which countries have data issues
predictor.check_country_data_availability()

if not models_loaded:
    print("Warning: Could not load some models. Fallback predictions will be used.")