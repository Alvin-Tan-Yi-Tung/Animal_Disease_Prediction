import requests
import pandas as pd

def get_woah_data():
    print("🚀 Starting WOAH Malaysia report scraper...")
    
    url = "https://wahis.woah.org/api/v1/events"
    params = {
        "country_iso3": "MYS",
        "page": "0",
        "size": "100",
        "sort": "reportDate,desc",
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://wahis.woah.org/",
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()  # Raise exception for bad status codes
        
        data = response.json()
        print(f"ℹ️ Found {data['totalElements']} reports")
        
        all_data = []
        for report in data["content"]:
            record = {
                "Disease": report["disease"]["name"],
                "Country": report["country"]["name"],
                "Report Date": report["reportDate"],
                "Start Date": report["startDate"],
                "End Date": report.get("endDate", ""),
                "Status": report["status"],
                "Species": ", ".join([s["name"] for s in report["species"]]),
                "Cases": report.get("cases", "N/A"),
                "Deaths": report.get("deaths", "N/A"),
                "Killed and Destroyed": report.get("killedAndDestroyed", "N/A"),
                "Slaughtered": report.get("slaughtered", "N/A"),
                "Vaccinated": report.get("vaccinated", "N/A")
            }
            all_data.append(record)
        
        # Save data
        df = pd.DataFrame(all_data)
        df.to_csv('malaysia_animal_disease_reports.csv', index=False, encoding='utf-8-sig')
        print(f"💾 Saved {len(all_data)} reports to CSV")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    if get_woah_data():
        print("✅ Success!")
    else:
        print("❌ Failed to retrieve data")
    
    input("Press Enter to exit...")