import json
from pathlib import Path

def add_character_fields():
    """Add empty 'name' and 'persona' fields to each character in the JSON file."""
    
    # Path to the JSON file
    json_path = Path(__file__).parent.parent / "frontend" / "public" / "characters" / "data" / "all-characters.json"
    
    # Load the JSON file
    print(f"Loading {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add name and persona fields to each character
    characters_updated = 0
    for char_id, char_data in data["characters"].items():
        if "name" not in char_data:
            char_data["name"] = ""
        if "persona" not in char_data:
            char_data["persona"] = ""
        characters_updated += 1
    
    print(f"Updated {characters_updated} characters with 'name' and 'persona' fields")
    
    # Save the updated JSON file
    print(f"Saving updated file to {json_path}...")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Done!")

if __name__ == "__main__":
    add_character_fields()
