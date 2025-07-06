import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Step 1: Setup Selenium WebDriver
def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Run in background (no browser window)
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    return driver

# Step 2: Crawl WOAH WAHIS for Malaysia reports
def crawl_woah_malaysia():
    url = "https://wahis.woah.org/#/event-management?Country=Malaysia"
    driver = setup_driver()
    driver.get(url)

    # Wait for the page to load fully (adjust time if needed)
    time.sleep(15)  # WAHIS is heavy on JavaScript
    
    # Step 3: Extract report elements
    reports = driver.find_elements(By.CLASS_NAME, 'report-result')

    data = []
    for report in reports:
        text = report.text.strip()
        if text:
            data.append({'Report Details': text})

    driver.quit()

    # Step 4: Save data to CSV
    if data:
        df = pd.DataFrame(data)
        df.to_csv('malaysia_animal_disease_reports.csv', index=False, encoding='utf-8-sig')
        print(f"✅ Successfully saved {len(data)} reports to malaysia_animal_disease_reports.csv")
    else:
        print("❌ No reports found or page did not load properly.")

# Step 5: Run the function
if __name__ == "__main__":
    crawl_woah_malaysia()
