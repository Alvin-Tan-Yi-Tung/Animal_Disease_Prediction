import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def get_woah_data_selenium():
    print("🚀 Starting WOAH Malaysia report scraper with Selenium...")

    # Setup Chrome options
    options = Options()
    options.add_argument("--headless")  # Run in headless mode (no window)
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    # Path to your ChromeDriver
    driver_path = "chromedriver"  # Adjust if needed

    # Start driver
    driver = webdriver.Chrome(service=Service(driver_path), options=options)
    wait = WebDriverWait(driver, 20)

    try:
        # Open the WAHIS event management page
        driver.get("https://wahis.woah.org/#/event-management")

        # Wait for page to load
        time.sleep(5)

        # Click country filter
        wait.until(EC.element_to_be_clickable((By.XPATH, '//label[contains(text(),"Country")]/..//button'))).click()

        # Click "Malaysia"
        wait.until(EC.element_to_be_clickable((By.XPATH, '//span[text()="Malaysia"]'))).click()

        # Click "Apply" button to search
        wait.until(EC.element_to_be_clickable((By.XPATH, '//button[.//span[text()="Apply"] or text()="Apply"]'))).click()

        print("⌛ Waiting for data to load...")
        time.sleep(5)  # Wait for results to appear

        # Scrape table rows
        rows = driver.find_elements(By.CSS_SELECTOR, "tbody tr")
        data = []

        for row in rows:
            cols = row.find_elements(By.TAG_NAME, "td")
            if len(cols) < 7:
                continue  # skip malformed rows

            data.append({
                "Disease": cols[0].text,
                "Country": cols[1].text,
                "Report Date": cols[2].text,
                "Start Date": cols[3].text,
                "End Date": cols[4].text,
                "Status": cols[5].text,
                "Species": cols[6].text,
            })

        df = pd.DataFrame(data)
        df.to_csv("malaysia_animal_disease_reports.csv", index=False, encoding='utf-8-sig')
        print(f"💾 Saved {len(df)} reports to 'malaysia_animal_disease_reports.csv'")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    finally:
        driver.quit()

if __name__ == "__main__":
    if get_woah_data_selenium():
        print("✅ Success!")
    else:
        print("❌ Failed to retrieve data")

    input("Press Enter to exit...")
