import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import traceback

def setup_driver():
    options = webdriver.ChromeOptions()
    
    # Completely disable GPU and hardware acceleration
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--no-sandbox')
    
    # Use the new headless mode
    options.add_argument('--headless=new')
    
    # Disable all problematic features
    options.add_argument('--disable-features=VoiceTranscription,Translate,BackForwardCache,IsolateOrigins,site-per-process')
    options.add_argument('--disable-blink-features=AutomationControlled')
    
    # Set window size
    options.add_argument('--window-size=1200,800')
    
    # Disable logging and automation flags
    options.add_experimental_option('excludeSwitches', ['enable-automation', 'enable-logging'])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Set modern user agent
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5790.110 Safari/537.36")
    
    # Use ChromeDriverManager to handle driver installation
    service = Service(ChromeDriverManager().install())
    
    # Set performance logging preferences to disable unnecessary logs
    options.set_capability('goog:loggingPrefs', {'performance': 'OFF', 'browser': 'OFF'})
    
    driver = webdriver.Chrome(service=service, options=options)
    
    # Execute JavaScript to prevent detection
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

def crawl_woah_malaysia():
    print("🚀 Starting WOAH Malaysia report scraper...")
    all_data = []  # Initialize here to avoid UnboundLocalError
    
    try:
        driver = setup_driver()
        url = "https://wahis.woah.org/#/event-management?Country=Malaysia"
        print(f"🌐 Accessing URL: {url}")
        driver.get(url)
        
        # Wait using JavaScript ready state
        print("⏳ Waiting for page to load...")
        WebDriverWait(driver, 60).until(
            lambda d: d.execute_script('return document.readyState') == 'complete'
        )
        print("✅ Page loaded successfully")
        
        # Wait for any element that indicates the page has loaded
        print("🔍 Waiting for page content...")
        WebDriverWait(driver, 60).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "div.container-fluid"))
        )
        print("✅ Content detected")
        
        # Additional wait specifically for the table
        print("🔍 Waiting for data table...")
        try:
            WebDriverWait(driver, 30).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, "table.table-event-management"))
            )
            print("✅ Table found")
        except:
            print("⚠️ Table not found, trying to continue anyway")
        
        # Get table headers
        print("📋 Extracting table headers...")
        try:
            headers = driver.execute_script('''
                const ths = Array.from(document.querySelectorAll('table.table-event-management thead tr th'));
                return ths.map(th => th.innerText.trim());
            ''')
            print(f"Detected columns: {headers}")
        except:
            print("⚠️ Failed to get headers, using default headers")
            headers = ["Disease", "Country", "Report date", "Start date", "End date", "Status"]
        
        if not headers:
            print("⚠️ No headers found, using default headers")
            headers = ["Disease", "Country", "Report date", "Start date", "End date", "Status"]
        
        page_count = 0
        max_pages = 50  # Safety limit to prevent infinite loops
        
        while page_count < max_pages:
            page_count += 1
            print(f"\n📄 Processing page {page_count}...")
            
            # Get table rows
            try:
                rows = driver.find_elements(By.CSS_SELECTOR, "table.table-event-management tbody tr")
                print(f"🔢 Found {len(rows)} rows on this page")
            except:
                print("⚠️ Failed to find rows, trying again")
                time.sleep(2)
                rows = driver.find_elements(By.CSS_SELECTOR, "table.table-event-management tbody tr")
                print(f"🔢 Found {len(rows)} rows on this page")
            
            if not rows:
                print("⚠️ No rows found - stopping")
                break
                
            # Process each row
            for i, row in enumerate(rows):
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    row_data = {}
                    
                    for idx in range(min(len(cells), len(headers))):
                        try:
                            row_data[headers[idx]] = cells[idx].text.strip()
                        except:
                            row_data[headers[idx]] = ""
                    
                    all_data.append(row_data)
                    if i % 5 == 0:  # Print progress every 5 rows
                        print(f"  Processed row {i+1}/{len(rows)}")
                except Exception as e:
                    print(f"⚠️ Error processing row {i}: {str(e)}")
            
            # Check for next page
            try:
                next_buttons = driver.find_elements(By.CSS_SELECTOR, "li.next:not(.disabled)")
                if not next_buttons:
                    print("⏹️ Reached last page")
                    break
                    
                print("➡️ Moving to next page...")
                
                # Scroll into view and click
                driver.execute_script("arguments[0].scrollIntoView();", next_buttons[0])
                next_buttons[0].find_element(By.TAG_NAME, "a").click()
                
                # Wait for new page to load
                time.sleep(3)  # Required for the JavaScript to execute
                WebDriverWait(driver, 30).until(
                    EC.staleness_of(rows[0])
                )
                print("✅ Next page loaded")
            except Exception as e:
                print(f"⚠️ Error navigating to next page: {str(e)}")
                break
                
        print(f"ℹ️ Processed {page_count} pages total")
            
    except Exception as e:
        print(f"❌ Error occurred: {str(e)}")
        traceback.print_exc()
    finally:
        if 'driver' in locals():
            driver.quit()
            print("🚫 Browser closed")
    
    # Save data
    if all_data:
        df = pd.DataFrame(all_data)
        filename = f'malaysia_animal_disease_reports_{len(all_data)}_rows.csv'
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"💾 Successfully saved {len(all_data)} reports to {filename}")
    else:
        print("❌ No data extracted")

if __name__ == "__main__":
    crawl_woah_malaysia()
    input("Press Enter to exit...")  # Keep window open