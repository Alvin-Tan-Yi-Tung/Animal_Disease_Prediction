import time
import csv
import os
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Setup browser with version matching
options = uc.ChromeOptions()
options.add_argument("--start-maximized")
driver = uc.Chrome(options=options)  # Match Chrome version
wait = WebDriverWait(driver, 20)

# Visit site
driver.get("https://wahis.woah.org/#/event-management")

# Close cookie popup
try:
    close_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div.close-cookie-pref")))
    driver.execute_script("arguments[0].click();", close_button)
    print("🍪 Closed cookie popup")
    time.sleep(1)

    # Click filter button
    filter_button = wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR, "body > app-root > div > app-public-interface > section > app-in-event-list-pi > div > app-in-event-list > div > mat-drawer-container > mat-drawer-content > div > div.flex-column.gap-5 > div.flex-justify-sb.title-padding > div.flex.gap-15 > button > span.mat-button-wrapper > div > span"
    )))
    driver.execute_script("arguments[0].click();", filter_button)
    print("🔍 Opened filter menu")
    time.sleep(1)

    # Click disease input
    disease_input = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#mat-input-5")))
    driver.execute_script("arguments[0].click();", disease_input)
    print("✏️ Clicked disease input")
    time.sleep(1)

    # Select Rabies option
    rabies_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#mat-option-349 > span")))
    driver.execute_script("arguments[0].click();", rabies_option)
    print("✅ Selected Rabies filter")
    time.sleep(2)

except Exception as e:
    print(f"[WARNING] Could not apply Rabies filter: {e}")

# Select 100 rows in the main event table
try:
    paginator_dropdown = wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR, "[id^='mat-select-'][aria-label='Items per page'] .mat-select-arrow"
    )))
    driver.execute_script("arguments[0].click();", paginator_dropdown)
    print("📂 Opened paginator dropdown")
    time.sleep(1)

    hundred_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), '100')]")))
    driver.execute_script("arguments[0].click();", hundred_option)
    print("✅ Set main table pagination to 100 rows.")
    time.sleep(3)

except Exception as pe:
    print("[WARNING] Failed to set pagination to 100:", pe)

# Define CSV filename with absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_filename = os.path.join(script_dir, "wahis_outbreak_details.csv")
print(f"📄 CSV will be saved to: {csv_filename}")

# Define CSV field names (added country as the first field)
CSV_FIELDS = [
    "country", "location", "lat_long", "start_date", 
    "end_date", "cases", "deaths"
]

# Initialize CSV file
if not os.path.exists(csv_filename):
    with open(csv_filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        print("📝 Created CSV file with headers")
else:
    print("📝 Using existing CSV file")

# Define CSS selectors for the data we want
DATA_SELECTORS = {
    "location": "app-outbreak-information-review div:nth-child(9) > div:nth-child(2) > p",
    "lat_long": "app-outbreak-information-review div:nth-child(10) > div:nth-child(2) > p",
    "start_date": "app-outbreak-information-review div:nth-child(2) > div:nth-child(2) > p",
    "end_date": "app-outbreak-information-review div:nth-child(3) > div:nth-child(2) > p",
    "cases": "app-quantitative-data-review mat-grid-tile:nth-child(11) div.mat-grid-tile-content",
    "deaths": "app-quantitative-data-review mat-grid-tile:nth-child(12) div.mat-grid-tile-content"
}

def save_to_csv(data_dict):
    """Save data to CSV with proper error handling"""
    try:
        with open(csv_filename, 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writerow(data_dict)
        print(f"💾 Saved data to CSV: {data_dict}")
        return True
    except Exception as e:
        print(f"❌ Failed to save to CSV: {e}")
        return False

def scrape_outbreak_details(country):
    """Scrape outbreak details from the modal and include country"""
    outbreak_data = {"country": country}
    
    try:
        # Wait for modal to fully load
        wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "app-outbreak-review-dialog"
        )))
        time.sleep(1)  # Additional stabilization
        
        # Scrape each data point
        for field, selector in DATA_SELECTORS.items():
            try:
                # Extract value
                value_element = driver.find_element(By.CSS_SELECTOR, selector)
                outbreak_data[field] = value_element.text.strip()
                print(f"  - {field}: {outbreak_data[field]}")
            except Exception as e:
                print(f"  - Could not scrape {field}: {e}")
                outbreak_data[field] = ""
        
        return outbreak_data
    
    except Exception as e:
        print(f"[ERROR] Failed to scrape outbreak details: {e}")
        return None

def close_outbreak_modal():
    """Close the outbreak detail modal"""
    try:
        close_button = wait.until(EC.element_to_be_clickable((
            By.XPATH, "//button[.//mat-icon[normalize-space()='close']]"
        )))
        driver.execute_script("arguments[0].click();", close_button)
        wait.until(EC.invisibility_of_element_located((
            By.CSS_SELECTOR, "app-outbreak-review-dialog"
        )))
        print("  - Closed outbreak modal.")
        time.sleep(1)
        return True
    except Exception as e:
        print(f"  - Could not close modal: {e}")
        return False

def scrape_outbreak_pages(country):
    """Scrape all outbreak details across multiple pages"""
    page_count = 1
    outbreak_count = 0
    
    while True:
        # Get outbreak buttons for current page
        outbreak_buttons = driver.find_elements(
            By.XPATH, "//mat-icon[normalize-space()='visibility']"
        )
        print(f"📑 Found {len(outbreak_buttons)} outbreak buttons on page {page_count}")
        
        # If no outbreak buttons found, exit immediately
        if not outbreak_buttons:
            print("⚠️ No outbreak details found for this event")
            return
        
        # Scrape all modals on current page
        for i in range(len(outbreak_buttons)):
            # Re-fetch buttons to avoid staleness
            buttons = driver.find_elements(
                By.XPATH, "//mat-icon[normalize-space()='visibility']"
            )
            if i >= len(buttons):
                break
                
            button = buttons[i]
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
            driver.execute_script("arguments[0].click();", button)
            print(f"\n🔍 Opening Outbreak Detail {i + 1}/{len(buttons)} on page {page_count}")
            time.sleep(2)

            # Scrape the modal data with country
            outbreak_data = scrape_outbreak_details(country)
            if outbreak_data:
                outbreak_count += 1
                # Save to CSV immediately
                if save_to_csv(outbreak_data):
                    print(f"  ✅ Scraped and saved outbreak #{outbreak_count}")
                else:
                    print("  ❌ Failed to save outbreak data")
            else:
                print("  ❌ Failed to scrape outbreak data")
                
            # Close modal regardless of success
            close_outbreak_modal()
        
        # Try to go to next page - use find_elements to avoid exception
        next_buttons = driver.find_elements(
            By.CSS_SELECTOR, "button.mat-paginator-navigation-next:not([disabled])"
        )
        
        if next_buttons and next_buttons[0].is_enabled():
            print("➡️ Attempting to go to next outbreak page")
            driver.execute_script("arguments[0].click();", next_buttons[0])
            time.sleep(3)
            page_count += 1
        else:
            print("⏹️ No more pages available")
            break
        
def process_matched_row(row, country):
    """Process a single matched disease row"""
    try:
        print(f"\n=== Processing Matched Disease for {country} ===")
        launch_button = row.find_element(
            By.XPATH, ".//button[.//mat-icon[normalize-space()='launch']]"
        )
        driver.execute_script("arguments[0].click();", launch_button)
        print("➡️ Entered Event Dashboard")
        time.sleep(3)

        # CLICK THE OUTBREAK TAB
        try:
            outbreak_tab = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//div[contains(@class, 'mat-tab-label-content') and contains(., 'OUTBREAK')]"
            )))
            driver.execute_script("arguments[0].click();", outbreak_tab)
            print("📑 Clicked Outbreak tab.")
            time.sleep(3)
        except Exception:
            try:
                outbreak_tab = wait.until(EC.element_to_be_clickable((
                    By.XPATH, "//div[contains(@class, 'mat-tab-label-content') and contains(translate(., 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'OUTBREAK')]"
                )))
                driver.execute_script("arguments[0].click();", outbreak_tab)
                print("📑 Clicked Outbreak tab using fallback.")
                time.sleep(3)
            except Exception:
                print("❌ Could not find Outbreak tab")
                close_event_dashboard()
                return False

        # VIEW DROPDOWN - Only attempt if needed
        try:
            view_dropdown = wait.until(EC.element_to_be_clickable((
                By.CSS_SELECTOR, "div.mat-select-arrow-wrapper"
            )))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", view_dropdown)
            driver.execute_script("arguments[0].click();", view_dropdown)
            time.sleep(1)

            options = wait.until(EC.presence_of_all_elements_located((
                By.CSS_SELECTOR, "mat-option span.mat-option-text"
            )))
            for opt in options:
                if "Outbreak" in opt.text:
                    driver.execute_script("arguments[0].click();", opt)
                    print(f"✅ Selected view: {opt.text.strip()}")
                    break
            time.sleep(2)
        except Exception:
            print("[WARNING] Could not change outbreak view - proceeding anyway")

        # FILTER DROPDOWN - Only attempt if needed
        try:
            filter_dropdown = wait.until(EC.element_to_be_clickable((
                By.CSS_SELECTOR, "div.mat-select-arrow-wrapper"
            )))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", filter_dropdown)
            driver.execute_script("arguments[0].click();", filter_dropdown)
            time.sleep(1)

            all_opts = driver.find_elements(
                By.CSS_SELECTOR, "mat-option span.mat-option-text"
            )
            for opt in all_opts:
                if "All" in opt.text:
                    driver.execute_script("arguments[0].click();", opt)
                    print(f"✅ Selected filter: {opt.text.strip()}")
                    break
            time.sleep(2)
        except Exception:
            print("[WARNING] Could not select 'All' filter - proceeding anyway")

        # PAGINATION DROPDOWN - Only attempt if needed
        try:
            pagination_dropdown = wait.until(EC.element_to_be_clickable((
                By.CSS_SELECTOR, "div.mat-paginator-page-size div.mat-select-arrow-wrapper"
            )))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", pagination_dropdown)
            driver.execute_script("arguments[0].click();", pagination_dropdown)
            time.sleep(1)
            
            options = driver.find_elements(
                By.CSS_SELECTOR, "mat-option span.mat-option-text"
            )
            for opt in options:
                if opt.text.strip() == "100":
                    driver.execute_script("arguments[0].click();", opt)
                    print("✅ Set outbreak pagination to 100 rows.")
                    break
            time.sleep(3)
        except Exception:
            print("[WARNING] Failed to set pagination to 100 - proceeding anyway")

        # Scrape outbreak details with country
        scrape_outbreak_pages(country)
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to process event dashboard: {e}")
        return False
    finally:
        close_event_dashboard()

def close_event_dashboard():
    """Close the event dashboard"""
    try:
        # Try multiple ways to find the close button
        try:
            # First try: XPath with close icon
            close_icon = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//app-in-event-dashboard//button[.//mat-icon[text()='close']]"
            )))
        except:
            # Second try: Generic close button in dashboard
            try:
                close_icon = wait.until(EC.element_to_be_clickable((
                    By.CSS_SELECTOR, "app-in-event-dashboard button.mat-icon-button"
                )))
            except:
                # Third try: Any close button in the dashboard
                try:
                    close_icon = wait.until(EC.element_to_be_clickable((
                        By.XPATH, "//app-in-event-dashboard//button[contains(@class, 'close')]"
                    )))
                except:
                    # Last resort: Close by URL navigation
                    driver.get("https://wahis.woah.org/#/event-management")
                    print("🔄 Navigated back to main page")
                    time.sleep(3)
                    return True
            
        driver.execute_script("arguments[0].click();", close_icon)
        print("🗙 Closed Event Dashboard")
        time.sleep(2)
        return True
    except Exception as e:
        print(f"⚠️ Could not close Event Dashboard: {e}")
        # As a last resort, navigate back to main page
        driver.get("https://wahis.woah.org/#/event-management")
        print("🔄 Navigated back to main page")
        time.sleep(3)
        return False

# Define disease keywords - ONLY RABIES
disease_keywords = ["rabies"]

try:
    current_page = 1
    total_matched = 0
    total_processed = 0
    processed_events = set()
    
    print("🔄 Initial pagination setup complete")
    
    while True:
        print(f"\n=== PROCESSING MAIN TABLE PAGE {current_page} ===")
        
        # Wait for table to load
        wait.until(EC.presence_of_element_located((
            By.CSS_SELECTOR, "#download-report .scroll-y-only > div"
        )))
        
        # Get all rows on current page
        rows = driver.find_elements(
            By.CSS_SELECTOR, "#download-report .scroll-y-only > div"
        )
        print(f"📄 Found {len(rows)} rows on page {current_page}")
        
        # Process each row
        for row_index, row in enumerate(rows):
            try:
                row_text = row.text.lower()
                # Check for disease match (RABIES ONLY)
                if any(keyword in row_text for keyword in disease_keywords):
                    total_matched += 1
                    print(f"\n=== MATCHED RABIES EVENT #{total_matched} ===")
                    print(f"Row text: {row_text[:100]}...")
                    
                    # Create unique event ID from row text
                    event_id = hash(row.text.strip())
                    
                    # Skip if already processed
                    if event_id in processed_events:
                        print(f"⏭️ Skipping already processed event")
                        continue
                    
                    # Extract country from the row
                    try:
                        country_element = row.find_element(
                            By.CSS_SELECTOR, "div.flex > div:nth-child(1) > span"
                        )
                        country = country_element.text.strip()
                        print(f"🌍 Country: {country}")
                    except Exception as e:
                        print(f"⚠️ Could not extract country: {e}")
                        country = "Unknown"
                    
                    # Process the matched disease
                    if process_matched_row(row, country):
                        total_processed += 1
                        processed_events.add(event_id)
                        print(f"✅ Successfully processed rabies event #{total_processed}/{total_matched}")
                    else:
                        print(f"⚠️ Failed to process rabies event #{total_matched}")
                    
                    # Return to main page
                    driver.get("https://wahis.woah.org/#/event-management")
                    print("🔄 Returned to main event management page")
                    time.sleep(3)
                    
                    # Break after processing one disease to restart from page 1
                    break
            except Exception as e:
                print(f"[ERROR] Failed to process row {row_index}: {e}")
        
        else:
            # This executes only if we didn't break out of the row loop
            # Try to go to next page of main table
            try:
                next_button = driver.find_element(
                    By.CSS_SELECTOR, "button.mat-paginator-navigation-next:not([disabled])"
                )
                if next_button.is_enabled():
                    print("⏭️ Moving to next page of main table")
                    driver.execute_script("arguments[0].click();", next_button)
                    time.sleep(3)
                    current_page += 1
                else:
                    print("🏁 Reached end of main table")
                    break
            except Exception:
                print("⏹️ No next page button found")
                break

        # Restart from page 1 after processing disease
        print("🔄 Restarting from page 1 after processing disease")
        current_page = 1
        driver.get("https://wahis.woah.org/#/event-management")
        time.sleep(3)
        
        # Reset pagination to 100 rows
        try:
            paginator_dropdown = wait.until(EC.element_to_be_clickable((
                By.CSS_SELECTOR, "[id^='mat-select-'][aria-label='Items per page'] .mat-select-arrow"
            )))
            driver.execute_script("arguments[0].click();", paginator_dropdown)
            time.sleep(1)
            hundred_option = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//span[contains(text(), '100')]"
            )))
            driver.execute_script("arguments[0].click();", hundred_option)
            time.sleep(3)
            print("🔄 Reset main table to 100 rows")
        except Exception:
            print("⚠️ Failed to reset main table pagination")

    print(f"\nTotal matched rabies events: {total_matched}")
    print(f"Total processed rabies events: {total_processed}")

except Exception as main_error:
    print(f"[MAIN ERROR] {main_error}")

finally:
    # Verify CSV content
    try:
        with open(csv_filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            row_count = sum(1 for row in reader)
            print(f"📊 CSV contains {row_count} records")
    except Exception as e:
        print(f"❌ Failed to read CSV: {e}")
    
    print("🔚 Scraping finished. Browser will remain open.")
    time.sleep(999)