import requests
import pandas as pd
from bs4 import BeautifulSoup
import time
import json

def scrape_with_scraperapi():
    print("🚀 Starting WOAH Malaysia report scraper with ScraperAPI...")
    
    # ScraperAPI configuration
    API_KEY = 'YOUR_API_KEY'  # Get a free API key from scraperapi.com
    base_url = "https://api.scraperapi.com"
    params = {
        'api_key': API_KEY,
        'url': 'https://wahis.woah.org/#/event-management',
        'render': 'true',
        'keep_headers': 'true'
    }
    
    all_data = []
    page = 1
    
    try:
        while page <= 50:  # Safety limit
            print(f"📄 Processing page {page}...")
            
            # Get page content with ScraperAPI
            response = requests.get(base_url, params=params)
            
            if response.status_code != 200:
                print(f"❌ API error: {response.status_code} - {response.text}")
                break
                
            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the table
            table = soup.find('table', {'class': 'table-event-management'})
            
            if not table:
                print("⚠️ Table not found on page")
                break
                
            # Extract headers
            if page == 1:
                headers = [th.get_text(strip=True) for th in table.find('thead').find_all('th')]
                print(f"📋 Detected columns: {headers}")
            
            # Extract rows
            rows = table.find('tbody').find_all('tr')
            print(f"🔢 Found {len(rows)} rows on this page")
            
            for row in rows:
                cells = row.find_all('td')
                row_data = {}
                
                for idx in range(min(len(cells), len(headers))):
                    row_data[headers[idx]] = cells[idx].get_text(strip=True)
                
                all_data.append(row_data)
            
            # Check for next page
            next_button = soup.select_one('li.next:not(.disabled)')
            
            if not next_button:
                print("⏹️ Reached last page")
                break
                
            print("➡️ Moving to next page...")
            
            # Update URL for next page
            next_page_url = next_button.find('a')['href']
            params['url'] = f"https://wahis.woah.org{next_page_url}"
            page += 1
            time.sleep(2)  # Be polite to the API
            
    except Exception as e:
        print(f"❌ Error occurred: {str(e)}")
    
    # Save data
    if all_data:
        df = pd.DataFrame(all_data)
        filename = f'malaysia_animal_disease_reports_{len(all_data)}_rows.csv'
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"💾 Successfully saved {len(all_data)} reports to {filename}")
    else:
        print("❌ No data extracted")

if __name__ == "__main__":
    scrape_with_scraperapi()
    input("Press Enter to exit...")