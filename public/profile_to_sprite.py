#!/usr/bin/env python3
"""
Profile Picture to LPC Sprite Generator (OpenAI Vision)

This script uses OpenAI GPT-4 Vision API to analyze profile pictures and extract
appearance features (hair color/length, skin tone, clothing color) with high accuracy.

Advantages:
- Very accurate feature detection using AI
- Handles edge cases (hats, unusual lighting, angles)
- Structured JSON output with response_format
- GPT-4o: $2.50 per million input tokens, $10 per million output tokens

Usage:
    python profile_to_sprite.py --url <image_url> --gender male|female [--output-dir output]
    python profile_to_sprite.py --image <local_path> --gender male|female [--output-dir output]
    python profile_to_sprite.py --batch <json_file> [--output-base-dir characters-pitch]

Setup:
    1. Get API key: https://platform.openai.com/api-keys
    2. Set environment variable:
       export OPENAI_API_KEY="your_api_key_here"
    3. Install dependencies:
       pip install openai Pillow opencv-python numpy requests
"""

import argparse
import os
import sys
import json
import random
import datetime
import re
from PIL import Image
import cv2
import numpy as np
import requests
from io import BytesIO

# OpenAI imports
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠ Warning: OpenAI not available. Install with: pip install openai")

# Sprite generation settings
SPRITESHEET_DIR = "../../technocracy-2/backend/character-gen/Universal-LPC-Spritesheet-Character-Generator/spritesheets"
ANIMATIONS = ["idle", "walk", "sit"]

# Simplified hair style categories
HAIR_STYLES = {
    "male": {
        "short": ["plain", "buzzcut", "natural", "messy1", "unkempt", "parted", "cowlick", "high_and_tight", "bedhead"],
        "medium": ["messy2", "curly_short", "mop", "swoop", "curtains", "bangsshort", "messy3", "parted2"],
        "long": ["long", "dreadlocks_long", "long_messy", "curly_long"]
    },
    "female": {
        "short": ["bob", "bob_side_part", "bangs", "bangs_bun", "pixie"],
        "medium": ["lob", "parted_side_bangs", "loose", "half_up", "parted_side_bangs2"],
        "long": ["long", "long_messy", "long_straight", "pigtails", "bangslong", "curly_long", "pigtails_bangs"]
    }
}

# Fallback hair styles
FALLBACK_HAIR = {
    "male": ["natural", "plain", "buzzcut"],
    "female": ["long", "bob", "bangs"]
}

# Skin colors (for fallback)
SKIN_COLORS = {
    "light": (255, 220, 177),
    "amber": (241, 194, 125),
    "olive": (198, 166, 100),
    "taupe": (166, 134, 94),
    "bronze": (140, 115, 87),
    "brown": (128, 79, 63),
    "black": (80, 51, 38)
}

# Clothing colors
CLOTHING_COLORS = {
    "white": (255, 255, 255),
    "black": (50, 50, 50),
    "gray": (128, 128, 128),
    "blue": (70, 130, 180),
    "navy": (30, 50, 100),
    "red": (180, 50, 50),
    "maroon": (128, 0, 0),
    "green": (60, 120, 60),
    "forest": (34, 80, 34),
    "brown": (120, 80, 50),
    "tan": (180, 150, 100),
    "purple": (120, 60, 140),
    "pink": (220, 150, 180),
    "orange": (220, 120, 50),
    "yellow": (220, 200, 80)
}


def get_openai_api_key():
    """Get OpenAI API key from environment variable."""
    api_key = os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print("\n✗ Error: OPENAI_API_KEY not found!")
        print("\nPlease set environment variable:")
        print("  export OPENAI_API_KEY='your_api_key_here'")
        print("\nTo get an API key:")
        print("  1. Go to https://platform.openai.com/api-keys")
        print("  2. Click 'Create new secret key'")
        print("  3. Copy the key and set the environment variable")
        print("\nNote: GPT-4o costs ~$0.01 per image analysis")
        return None
    
    return api_key


def download_image(url):
    """Download image from URL and return PIL Image."""
    try:
        print(f"Downloading image from URL...")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        print(f"✓ Downloaded image: {img.size}")
        return img
    except Exception as e:
        print(f"✗ Error downloading image: {e}")
        return None


def load_image(path):
    """Load image from local path."""
    try:
        img = Image.open(path)
        print(f"✓ Loaded image: {img.size}")
        return img
    except Exception as e:
        print(f"✗ Error loading image: {e}")
        return None


def detect_face_with_opencv(img):
    """Fallback face detection using OpenCV."""
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(face_cascade_path)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        return None
    
    face = max(faces, key=lambda f: f[2] * f[3])
    return face


def extract_dominant_color(img, region):
    """Extract dominant color from a region using median."""
    x, y, w, h = region
    cropped = img.crop((x, y, x + w, y + h))
    pixels = np.array(cropped).reshape(-1, 3)
    
    # Remove very dark and very bright pixels
    pixels = pixels[np.all(pixels > 20, axis=1) & np.all(pixels < 235, axis=1)]
    
    if len(pixels) == 0:
        return (128, 128, 128)
    
    median_color = np.median(pixels, axis=0).astype(int)
    return tuple(median_color)


def color_distance(c1, c2):
    """Calculate Euclidean distance between two RGB colors."""
    return np.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def match_closest_color(color, color_palette):
    """Find the closest color name from palette."""
    min_dist = float('inf')
    closest_name = None
    
    for name, palette_color in color_palette.items():
        dist = color_distance(color, palette_color)
        if dist < min_dist:
            min_dist = dist
            closest_name = name
    
    return closest_name


def estimate_hair_length_fallback(img, face_region):
    """Fallback hair length estimation using OpenCV."""
    if face_region is None:
        return "medium"
    
    x, y, w, h = face_region
    
    hair_y_start = max(0, y - int(h * 1.0))
    hair_crop = img.crop((x, hair_y_start, x + w, y))
    hair_pixels = np.array(hair_crop)
    
    if hair_pixels.shape[0] == 0:
        return "medium"
    
    non_bg_mask = np.any(hair_pixels < 240, axis=2)
    
    height_pixels = hair_pixels.shape[0]
    short_threshold = int(height_pixels * 0.7)
    medium_threshold = int(height_pixels * 0.4)
    
    coverage_short = np.mean(non_bg_mask[short_threshold:]) if short_threshold < height_pixels else 0
    coverage_medium = np.mean(non_bg_mask[medium_threshold:short_threshold]) if medium_threshold < short_threshold else 0
    
    if coverage_short > 0.3:
        return "long"
    elif coverage_medium > 0.3:
        return "medium"
    else:
        return "short"


def extract_features_with_openai(img, img_path=None):
    """
    Extract appearance features using OpenAI GPT-4 Vision API.
    
    Returns:
        dict with keys: skin_color, hair_color, hair_length, shirt_color, gender, confidence
    """
    print("\n" + "=" * 50)
    print("Extracting features with OpenAI GPT-4 Vision")
    print("=" * 50)
    
    features = {
        "skin_color": "light",
        "hair_color": "dark_brown",
        "hair_length": "medium",
        "shirt_color": "blue",
        "gender": "male",
        "confidence": {}
    }
    
    # Check OpenAI availability
    if not OPENAI_AVAILABLE:
        print("✗ OpenAI SDK not installed. Using fallback detection.")
        return extract_features_fallback(img)
    
    # Get API key
    api_key = get_openai_api_key()
    if not api_key:
        print("✗ OpenAI API key not configured. Using fallback detection.")
        return extract_features_fallback(img)
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    try:
        print("Calling OpenAI GPT-4 Vision API...")
        
        # Prepare image for OpenAI
        if img_path and img_path.startswith('http'):
            # URL image
            image_content = {"type": "image_url", "image_url": {"url": img_path}}
        else:
            # Local image - convert to base64
            import base64
            from io import BytesIO
            
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            image_content = {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}
            }
        
        # Create the messages
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Analyze this profile picture and extract the following features. Return ONLY a JSON object with these exact keys:

{
    "gender": "choose ONE from: male, female",
    "hair_color": "choose ONE from: blonde, light_brown, dark_brown, black, red, gray, white. If unsure whether light_brown or blonde, choose blonde.",
    "hair_length": "choose ONE from: short, medium, long",
    "skin_color": "choose ONE from: light, amber, olive, taupe, bronze, brown, black",
    "shirt_color": "choose ONE from: white, black, gray, blue, navy, red, maroon, green, forest, brown, tan, purple, pink, orange, yellow"
}

Guidelines:
- gender: Determine based on facial features and presentation style. If uncertain, make best estimate.
- hair_length: short = above ears, medium = shoulder length, long = below shoulders
- For skin_color: light (pale/fair), amber (light tan), olive (medium tan), taupe (tan), bronze (deeper tan), brown (brown), black (dark brown/black)
- Choose the most dominant/visible clothing color for shirt_color
- If a feature is not visible or unclear, make your best estimate"""
                    },
                    image_content
                ]
            }
        ]
        
        # Call OpenAI API with JSON mode
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=500
        )
        
        # Parse response
        response_text = response.choices[0].message.content.strip()
        
        print(f"\nOpenAI response:\n{response_text}\n")
        
        # Parse JSON
        openai_features = json.loads(response_text)
        
        # Update features with OpenAI results
        features["gender"] = openai_features.get("gender", "male")
        features["hair_color"] = openai_features.get("hair_color", "dark_brown")
        features["hair_length"] = openai_features.get("hair_length", "medium")
        features["skin_color"] = openai_features.get("skin_color", "light")
        features["shirt_color"] = openai_features.get("shirt_color", "blue")
        
        # Set high confidence for all OpenAI results
        features["confidence"] = {
            "gender": "high",
            "skin": "high",
            "hair_color": "high",
            "hair_length": "high",
            "shirt": "high"
        }
        
        print(f"✓ Gender: {features['gender']}")
        print(f"✓ Hair color: {features['hair_color']}")
        print(f"✓ Hair length: {features['hair_length']}")
        print(f"✓ Skin color: {features['skin_color']}")
        print(f"✓ Shirt color: {features['shirt_color']}")
        
    except json.JSONDecodeError as e:
        print(f"✗ Failed to parse OpenAI response as JSON: {e}")
        print(f"   Response was: {response_text}")
        print("   Falling back to OpenCV detection...")
        return extract_features_fallback(img)
        
    except Exception as e:
        print(f"✗ OpenAI API call failed: {e}")
        print("   Falling back to OpenCV detection...")
        return extract_features_fallback(img)
    
    return features


def extract_features_fallback(img):
    """Fallback feature extraction using OpenCV."""
    print("\nUsing fallback OpenCV detection...")
    
    features = {
        "gender": "male",
        "skin_color": "light",
        "hair_color": "dark_brown",
        "hair_length": "medium",
        "shirt_color": "blue",
        "confidence": {}
    }
    
    face_region = detect_face_with_opencv(img)
    
    if face_region is None:
        print("⚠ No face detected")
        features["confidence"] = {"gender": "low", "skin": "low", "hair_color": "low", "hair_length": "low", "shirt": "low"}
        return features
    
    x, y, w, h = face_region
    print(f"✓ Face detected at ({x}, {y}) size {w}x{h}")
    
    # Skin tone
    skin_region = (x + int(w * 0.3), y + int(h * 0.3), int(w * 0.4), int(h * 0.4))
    skin_color_rgb = extract_dominant_color(img, skin_region)
    features["skin_color"] = match_closest_color(skin_color_rgb, SKIN_COLORS)
    print(f"✓ Detected skin tone: {features['skin_color']}")
    features["confidence"]["skin"] = "medium"
    
    # Hair color (simple RGB-based)
    hair_region = (x, max(0, y - int(h * 0.4)), w, int(h * 0.4))
    hair_color_rgb = extract_dominant_color(img, hair_region)
    # Simple hair color classification
    r, g, b = hair_color_rgb
    brightness = (r + g + b) / 3
    if brightness < 50:
        features["hair_color"] = "black"
    elif brightness < 100:
        features["hair_color"] = "dark_brown"
    elif brightness < 150:
        features["hair_color"] = "light_brown"
    else:
        features["hair_color"] = "blonde"
    print(f"✓ Detected hair color: {features['hair_color']}")
    features["confidence"]["hair_color"] = "low"
    
    # Hair length
    features["hair_length"] = estimate_hair_length_fallback(img, face_region)
    print(f"✓ Estimated hair length: {features['hair_length']}")
    features["confidence"]["hair_length"] = "low"
    
    # Clothing
    clothing_region = (x, y + h, w, min(int(h * 0.5), img.height - (y + h)))
    if clothing_region[3] > 10:
        clothing_color_rgb = extract_dominant_color(img, clothing_region)
        features["shirt_color"] = match_closest_color(clothing_color_rgb, CLOTHING_COLORS)
        print(f"✓ Detected clothing color: {features['shirt_color']}")
        features["confidence"]["shirt"] = "medium"
    else:
        features["confidence"]["shirt"] = "low"
    
    return features


def validate_hair_style(hair_style, animation, hair_color):
    """Check if a hair style file exists for the given animation and color."""
    path = os.path.join(SPRITESHEET_DIR, f"hair/{hair_style}/adult/{animation}/{hair_color}.png")
    return os.path.exists(path)


def select_hair_style(gender, hair_length, animation="idle", hair_color="dark_brown"):
    """Select a random hair style based on gender and length, with validation."""
    styles = HAIR_STYLES[gender][hair_length].copy()
    
    random.shuffle(styles)
    for style in styles:
        if validate_hair_style(style, animation, hair_color):
            return style
    
    print(f"⚠ No valid {hair_length} hair styles found, trying fallbacks...")
    for fallback in FALLBACK_HAIR[gender]:
        if validate_hair_style(fallback, animation, hair_color):
            print(f"  Using fallback: {fallback}")
            return fallback
    
    return HAIR_STYLES[gender][hair_length][0]


def generate_sprite_from_features(features, output_dir="generated_sprites"):
    """Generate sprite using extracted features."""
    
    gender = features.get("gender", "male")
    
    hair_style = select_hair_style(
        gender, 
        features["hair_length"],
        animation="idle",
        hair_color=features["hair_color"]
    )
    
    print(f"\nSelected hair style: {hair_style}")
    
    generated_files = []
    
    for animation in ANIMATIONS:
        print(f"\n>>> Generating {animation.upper()} animation...")
        
        layers = get_layers_for_animation(
            animation=animation,
            gender=gender,
            skin_color=features["skin_color"],
            hair_color=features["hair_color"],
            hair_style=hair_style,
            shirt_color=features["shirt_color"],
            leg_color="blue",
            shoe_color="black"
        )
        
        result = generate_sprite(
            layers,
            output_filename=f"sprite_{animation}.png",
            output_dir=output_dir
        )
        
        if result:
            generated_files.append(result)
    
    # Save features metadata (separate from character metadata in batch mode)
    features_path = os.path.join(output_dir, "sprite_features.json")
    with open(features_path, 'w') as f:
        json.dump({
            "extracted_features": features,
            "selected_style": {
                "gender": gender,
                "hair_style": hair_style
            },
            "generated": datetime.datetime.now().isoformat(),
            "method": "OpenAI GPT-4 Vision API"
        }, f, indent=2)
    
    print(f"\n✓ Feature metadata saved to: {features_path}")
    
    return generated_files


def get_layers_for_animation(animation, gender, skin_color, hair_color, hair_style,
                              shirt_color, leg_color, shoe_color):
    """Generate sprite layer paths for animation."""
    
    leg_body_type = "thin" if gender == "female" else gender
    
    layers = [
        f"body/bodies/{gender}/{animation}/{skin_color}.png",
        f"head/heads/human/{gender}/{animation}/{skin_color}.png",
        f"head/nose/big/adult/{animation}/{skin_color}.png",
        f"eyes/human/adult/default/{animation}/brown.png",
        f"hair/{hair_style}/adult/{animation}/{hair_color}.png",
        f"torso/clothes/longsleeve/longsleeve/{gender}/{animation}/{shirt_color}.png",
        f"legs/pants/{leg_body_type}/{animation}/{leg_color}.png",
    ]
    
    if gender == "female":
        layers.append(f"feet/shoes/revised/thin/{animation}/{shoe_color}.png")
    else:
        layers.append(f"feet/shoes/basic/male/{animation}/{shoe_color}.png")
    
    return layers


def generate_sprite(layers, output_filename, output_dir):
    """Generate sprite by compositing layers."""
    
    os.makedirs(output_dir, exist_ok=True)
    
    composite_image = None
    
    print("Generating sprite...")
    print("-" * 50)
    
    for i, layer_path in enumerate(layers):
        full_path = os.path.join(SPRITESHEET_DIR, layer_path)
        
        if not os.path.exists(full_path):
            print(f"⚠ Warning: Layer not found: {layer_path}")
            continue
        
        try:
            layer_img = Image.open(full_path).convert("RGBA")
            print(f"✓ Loaded layer {i+1}/{len(layers)}: {layer_path}")
            
            if composite_image is None:
                composite_image = layer_img
            else:
                composite_image = Image.alpha_composite(composite_image, layer_img)
        except Exception as e:
            print(f"✗ Error loading {full_path}: {e}")
            continue
    
    if composite_image is None:
        print("\n✗ Error: No valid layers could be loaded!")
        return None
    
    output_path = os.path.join(output_dir, output_filename)
    composite_image.save(output_path, "PNG")
    
    print("-" * 50)
    print(f"✓ Sprite saved to: {output_path}")
    
    return output_path


def extract_photo_url_from_scraped_data(scraped_data):
    """Extract photo URL from scraped LinkedIn data."""
    match = re.search(r'PHOTO URL:\s*(https?://[^\s\n]+)', scraped_data)
    if match:
        return match.group(1)
    return None


def sanitize_dirname(name):
    """Convert name to safe directory name."""
    # Remove special characters, replace spaces with underscores
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[-\s]+', '_', name)
    return name.lower()


def process_batch_characters(json_file, output_base_dir="characters-general"):
    """Process all characters from JSON file."""
    print("=" * 50)
    print("BATCH CHARACTER PROCESSING")
    print("=" * 50)
    
    # Load JSON file
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"✗ Error loading JSON file: {e}")
        return 1
    
    # Count characters (excluding company_information)
    characters = {k: v for k, v in data.items() if k.startswith('character_')}
    total = len(characters)
    
    print(f"\nFound {total} characters to process\n")
    
    results = {
        "processed": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "characters": {}
    }
    
    for idx, (char_id, char_data) in enumerate(characters.items(), 1):
        name = char_data.get('name', 'Unknown')
        character_id = char_data.get('id', char_id.split('_')[1])
        scraped_data = char_data.get('scraped_data', '')
        
        print("\n" + "=" * 50)
        print(f"Processing {idx}/{total}: {name} (ID: {character_id})")
        print("=" * 50)
        
        # Extract photo URL
        photo_url = extract_photo_url_from_scraped_data(scraped_data)
        
        if not photo_url:
            print(f"⚠ No photo URL found in scraped data, skipping...")
            results["skipped"] += 1
            results["characters"][char_id] = {
                "name": name,
                "status": "skipped",
                "reason": "no_photo_url"
            }
            continue
        
        print(f"✓ Found photo URL: {photo_url[:80]}...")
        
        # Create character directory
        safe_name = sanitize_dirname(name)
        char_dir = os.path.join(output_base_dir, f"character_{character_id}")
        os.makedirs(char_dir, exist_ok=True)
        print(f"✓ Created directory: {char_dir}")
        
        # Download image
        img = download_image(photo_url)
        if img is None:
            print(f"✗ Failed to download image")
            results["failed"] += 1
            results["characters"][char_id] = {
                "name": name,
                "status": "failed",
                "reason": "download_failed"
            }
            continue
        
        # Extract features
        features = extract_features_with_openai(img, photo_url)
        
        # Generate sprites
        try:
            generated_files = generate_sprite_from_features(features, char_dir)
            
            # Save character metadata
            metadata = {
                "character_id": character_id,
                "name": name,
                "photo_url": photo_url,
                "extracted_features": features,
                "generated_files": generated_files,
                "processed_at": datetime.datetime.now().isoformat()
            }
            
            metadata_path = os.path.join(char_dir, "character_metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"\n✓ SUCCESS: Generated {len(generated_files)} sprite(s) for {name}")
            print(f"✓ Metadata saved to: {metadata_path}")
            
            results["success"] += 1
            results["characters"][char_id] = {
                "name": name,
                "status": "success",
                "directory": char_dir,
                "sprites": len(generated_files)
            }
            
        except Exception as e:
            print(f"\n✗ FAILED: Error generating sprites: {e}")
            results["failed"] += 1
            results["characters"][char_id] = {
                "name": name,
                "status": "failed",
                "reason": str(e)
            }
        
        results["processed"] += 1
    
    # Save batch results
    batch_results_path = os.path.join(output_base_dir, "batch_processing_results.json")
    with open(batch_results_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 50)
    print("BATCH PROCESSING SUMMARY")
    print("=" * 50)
    print(f"Total characters: {total}")
    print(f"Processed: {results['processed']}")
    print(f"✓ Success: {results['success']}")
    print(f"✗ Failed: {results['failed']}")
    print(f"⚠ Skipped: {results['skipped']}")
    print(f"\nResults saved to: {batch_results_path}")
    
    return 0 if results["failed"] == 0 else 1


def main():
    parser = argparse.ArgumentParser(
        description='Generate LPC sprite from profile picture (OpenAI Vision)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single character
  python profile_to_sprite.py --url https://example.com/photo.jpg
  python profile_to_sprite.py --image photo.jpg --gender female --output-dir my_sprites
  
  # Batch processing
  python profile_to_sprite.py --batch all-characters-pitch.json --output-base-dir characters-pitch

Setup:
  1. Get API key from https://platform.openai.com/api-keys
  2. export OPENAI_API_KEY="your_api_key_here"
  3. pip install openai

Cost: ~$0.01 per image with GPT-4o
        """
    )
    
    parser.add_argument('--url', type=str, help='URL of profile picture')
    parser.add_argument('--image', type=str, help='Path to local image file')
    parser.add_argument('--batch', type=str, help='JSON file with multiple characters to process')
    parser.add_argument('--gender', type=str, choices=['male', 'female'],
                       help='Character gender (optional, will be auto-detected if not provided)')
    parser.add_argument('--output-dir', type=str, default='generated_sprites',
                       help='Output directory for single character (default: generated_sprites)')
    parser.add_argument('--output-base-dir', type=str, default='characters-pitch',
                       help='Base output directory for batch processing (default: characters-pitch)')
    
    args = parser.parse_args()
    
    # Batch processing mode
    if args.batch:
        return process_batch_characters(args.batch, args.output_base_dir)
    
    # Single character mode
    if not args.url and not args.image:
        print("✗ Error: Must provide either --url, --image, or --batch")
        parser.print_help()
        return 1
    
    if args.url and args.image:
        print("✗ Error: Provide only --url OR --image, not both")
        return 1
    
    if not OPENAI_AVAILABLE:
        print("\n⚠ Warning: OpenAI is not installed!")
        print("   Install with: pip install openai")
        print("   Continuing with OpenCV-only analysis (less accurate)...\n")
    
    print("=" * 50)
    print("Profile Picture to LPC Sprite Generator (OpenAI)")
    print("=" * 50)
    
    # Load image
    if args.url:
        img = download_image(args.url)
        img_path = None
    else:
        img = load_image(args.image)
        img_path = args.image
    
    if img is None:
        return 1
    
    # Extract features
    features = extract_features_with_openai(img, args.url if args.url else img_path)
    
    # Override gender if provided as argument
    if args.gender:
        print(f"\n⚠ Overriding detected gender with: {args.gender}")
        features["gender"] = args.gender
        features["confidence"]["gender"] = "override"
    
    # Display extracted features
    print("\n" + "=" * 50)
    print("Extracted Features:")
    print("=" * 50)
    print(f"  Gender: {features['gender']} (confidence: {features['confidence']['gender']})")
    print(f"  Skin tone: {features['skin_color']} (confidence: {features['confidence']['skin']})")  
    print(f"  Hair color: {features['hair_color']} (confidence: {features['confidence']['hair_color']})")  
    print(f"  Hair length: {features['hair_length']} (confidence: {features['confidence']['hair_length']})")  
    print(f"  Shirt color: {features['shirt_color']} (confidence: {features['confidence']['shirt']})")
    
    # Generate sprites
    generated_files = generate_sprite_from_features(features, args.output_dir)    # Summary
    print("\n" + "=" * 50)
    if generated_files:
        print(f"✓ Success! Generated {len(generated_files)} sprite animation(s):")
        for file in generated_files:
            print(f"  • {file}")
    else:
        print("✗ Failed to generate sprites")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
