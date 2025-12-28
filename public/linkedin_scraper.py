import sys
import time
import random
import os
import json
import hashlib
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium_stealth import stealth
from bs4 import BeautifulSoup


class ParsedHtmlScraper:
    """
    Scrapes LinkedIn profiles using a persistent Chrome profile to maintain login state.
    Parses specific sections (About, Experience, Education, Skills, Profile Photo).
    """
    
    JSON_FILE_PATH = "/home/rklotins/src/technocracy-hack/public/all-characters-general.json"

    def __init__(self):
        self.driver = None
        self._setup_driver()
        self._ensure_json_file()

    def _generate_id(self, name):
        """Generate a 6-digit hash ID based on the name."""
        hash_obj = hashlib.md5(name.encode())
        hash_hex = hash_obj.hexdigest()
        # Take first 6 characters and ensure it's numeric by converting hex to int and taking modulo
        numeric_hash = int(hash_hex[:8], 16) % 1000000
        return f"{numeric_hash:06d}"
    
    def _ensure_json_file(self):
        """Ensure the JSON file exists with proper structure."""
        if not os.path.exists(self.JSON_FILE_PATH):
            initial_data = {"company_information": ""}
            with open(self.JSON_FILE_PATH, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f, indent=2, ensure_ascii=False)
            print(f"Created new JSON file at {self.JSON_FILE_PATH}")
    
    def _save_character_to_json(self, name, scraped_data):
        """Save character data to JSON file."""
        try:
            # Read existing data
            try:
                with open(self.JSON_FILE_PATH, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if not content:
                        data = {"company_information": ""}
                    else:
                        data = json.loads(content)
            except (json.JSONDecodeError, FileNotFoundError):
                data = {"company_information": ""}
            
            # Generate ID
            char_id = self._generate_id(name)
            character_key = f"character_{char_id}"
            
            # Create character entry
            data[character_key] = {
                "name": name,
                "id": char_id,
                "scraped_data": scraped_data,
                "persona": ""
            }
            
            # Write back to file
            with open(self.JSON_FILE_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Saved {name} (ID: {char_id}) to {self.JSON_FILE_PATH}")
            return character_key
            
        except Exception as e:
            print(f"❌ Error saving to JSON: {e}")
            return None

    def _setup_driver(self):
        """
        Configures and returns a Selenium WebDriver instance with a persistent profile.
        """
        try:
            print("Initializing WebDriver...")
            options = webdriver.ChromeOptions()

            # --- PERSISTENT PROFILE SETUP ---
            # This creates a folder named 'chrome_data' in the same directory as this script.
            # Chrome will save your login cookies here.
            current_dir = os.path.dirname(os.path.abspath(__file__))
            profile_path = os.path.join(current_dir, 'chrome_data')
            os.makedirs(profile_path, exist_ok=True)
            options.add_argument(f"user-data-dir={profile_path}")
            # -------------------------------------

            options.add_argument("start-maximized")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Use chromium-browser binary on Ubuntu
            options.binary_location = "/usr/bin/chromium-browser"

            self.driver = webdriver.Chrome(options=options)

            stealth(self.driver,
                    languages=["en-US", "en"],
                    vendor="Google Inc.",
                    platform="Linux x86_64",
                    webgl_vendor="Intel Inc.",
                    renderer="Intel Iris OpenGL Engine",
                    fix_hairline=True,
                    )

            print("✅ WebDriver with persistent profile initialized.")
            print(f"   (Data stored in: {profile_path})")
        except Exception as e:
            print(f"❌ Error setting up WebDriver: {e}")
            sys.exit(1)

    def get_raw_html(self, url):
        """
        Navigates to the URL and returns its full raw HTML content.
        Includes a safety delay to allow dynamic content to load.
        """
        try:
            print(f"Navigating directly to: {url}")
            self.driver.get(url)

            # --- SAFETY DELAY ---
            # Wait for LinkedIn to fetch dynamic data (Education, Skills, etc.)
            print("Waiting 15-20 seconds for page to fully render...")
            time.sleep(random.uniform(5, 10))
            # --------------------

            # CDP logic to get full_html (bypasses some basic restrictions)
            print("Attempting to get HTML using Chrome DevTools Protocol (CDP)...")
            doc_root = self.driver.execute_cdp_cmd('DOM.getDocument', {'depth': -1})
            result = self.driver.execute_cdp_cmd('DOM.getOuterHTML', {'nodeId': doc_root['root']['nodeId']})
            full_html = result.get('outerHTML', '')

            return full_html

        except Exception as e:
            print(f"FAILED to process URL: {url}. Error: {e}")
            return None

    def _parse_and_clean_html(self, full_html):
        """
        Parses the HTML to extract specific profile sections:
        Header, About, Experience, Education, Skills, and Profile Photo.
        """
        print("Parsing profile data...")
        try:
            soup = BeautifulSoup(full_html, 'html.parser')

            # --- 1. Clean up "visually-hidden" text ---
            # LinkedIn duplicates text for screen readers. Removing this cleans up the output.
            for hidden in soup.find_all(class_="visually-hidden"):
                hidden.decompose()

            extracted_data = {}

            # --- 2. Extract Basic Info (Name, Headline, Location) ---
            top_card = soup.find('section', class_='artdeco-card')
            if top_card:
                name_tag = top_card.find('h1')
                extracted_data['Name'] = name_tag.get_text(strip=True) if name_tag else "N/A"

                headline_tag = top_card.find('div', class_='text-body-medium')
                extracted_data['Headline'] = headline_tag.get_text(strip=True) if headline_tag else "N/A"

                loc_tag = top_card.find('span', class_='text-body-small')
                extracted_data['Location'] = loc_tag.get_text(strip=True) if loc_tag else "N/A"

            # --- 3. Extract Profile Photo URL ---
            # We look for the image specifically in the top card with the class 'pv-top-card-profile-picture__image--show'
            extracted_data['Profile Photo'] = "N/A"
            photo_tag = soup.find('img', class_='pv-top-card-profile-picture__image--show')
            if photo_tag and photo_tag.has_attr('src'):
                extracted_data['Profile Photo'] = photo_tag['src']

            # --- 4. Helper function to extract section data ---
            def get_section_text(anchor_id):
                """Finds a section by its anchor ID and extracts list items."""
                anchor = soup.find('div', id=anchor_id)
                if not anchor:
                    return []

                # The content is usually in the parent section of the anchor
                section = anchor.find_parent('section')
                if not section:
                    return []

                # Find all list items in this section
                items = []
                for li in section.find_all('li', class_='artdeco-list__item'):
                    # Get text, separating blocks by a pipe | for readability
                    text = li.get_text(separator=' | ', strip=True)
                    # Basic cleanup to remove excessive pipes/spaces
                    clean_text = ' '.join(text.split())
                    items.append(clean_text)
                return items

            # --- 5. Extract Specific Sections ---

            # About Section (Updated Fuzzy Logic)
            extracted_data['About'] = "N/A"
            about_anchor = soup.find('div', id='about')
            if about_anchor:
                about_section = about_anchor.find_parent('section')
                if about_section:
                    # Look for a div that has a class containing 'inline-show-more-text'
                    about_text_div = about_section.find(
                        lambda tag: tag.name == "div" and
                                    tag.get("class") and
                                    any("inline-show-more-text" in c for c in tag.get("class"))
                    )
                    if about_text_div:
                        extracted_data['About'] = about_text_div.get_text(separator=" ", strip=True)

            # Lists
            extracted_data['Experience'] = get_section_text('experience')
            extracted_data['Education'] = get_section_text('education')
            extracted_data['Skills'] = get_section_text('skills')

            # --- 6. Format Output ---
            output = "\n================ SCRAPED PROFILE DATA ================\n"

            # Print Header Info
            output += f"NAME:     {extracted_data.get('Name')}\n"
            output += f"HEADLINE: {extracted_data.get('Headline')}\n"
            output += f"LOCATION: {extracted_data.get('Location')}\n"
            output += f"PHOTO URL: {extracted_data.get('Profile Photo')}\n"
            output += f"\n[ABOUT]\n{extracted_data.get('About')}\n"

            # Print Lists
            for section in ['Experience', 'Education', 'Skills']:
                output += f"\n[{section.upper()}]\n"
                items = extracted_data.get(section, [])
                if not items:
                    output += "  No data found (or section not loaded).\n"
                else:
                    for i, item in enumerate(items, 1):
                        output += f"  {i}. {item}\n"

            output += "\n======================================================\n"
            return output, extracted_data

        except Exception as e:
            print(f"❌ Error during HTML parsing: {e}")
            return None, None

    def run(self):
        """
        Main loop to accept user input and scrape URLs.
        """
        print("\nParsed HTML Scraper is ready.")
        print("NOTE: If you are not logged in, please log in to LinkedIn in the Chrome window now.")
        print("Once logged in, you can paste the URL below.")
        print("Enter the full URL (e.g., https://www.linkedin.com/in/your-name/)")
        print("Type 'q' or 'quit' to exit.")

        while True:
            user_url = input("\nEnter URL: ").strip()

            if user_url.lower() in ['q', 'quit']:
                print("Exiting...")
                break

            if not user_url.startswith('http'):
                print("Invalid URL. Please make sure it starts with 'http' or 'https'.")
                continue

            # Scrape the URL
            full_html = self.get_raw_html(user_url)

            if full_html:
                formatted_output, extracted_data = self._parse_and_clean_html(full_html)
                
                if formatted_output and extracted_data:
                    print(formatted_output)
                    
                    # Save to JSON
                    name = extracted_data.get('Name', 'Unknown')
                    if name != 'N/A' and name != 'Unknown':
                        self._save_character_to_json(name, formatted_output)
                    else:
                        print("⚠️ Could not extract name, skipping JSON save.")

    def close(self):
        """Cleans up and closes the web driver."""
        print("Cleaning up and closing the web driver.")
        if self.driver:
            self.driver.quit()


if __name__ == '__main__':
    scraper = ParsedHtmlScraper()
    try:
        scraper.run()
    except KeyboardInterrupt:
        print("\n[!] Stop signal received. Exiting.")
    finally:
        scraper.close()