#!/usr/bin/env python3
"""
Generate Character Personas from LinkedIn Data using OpenAI

This script reads scraped LinkedIn profiles and generates rich character personas
suitable for interview simulations using OpenAI's GPT-4 API.

Usage:
    python generate_personas.py --input all-characters-pitch.json --output all-characters-pitch-with-personas.json

Setup:
    1. Get API key: https://platform.openai.com/api-keys
    2. Set environment variable:
       export OPENAI_API_KEY="your_api_key_here"
    3. Install dependencies:
       pip install openai
"""

import argparse
import os
import sys
import json
import time
from datetime import datetime

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("✗ Error: OpenAI SDK not installed!")
    print("  Install with: pip install openai")
    sys.exit(1)


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
        return None
    
    return api_key


def generate_persona_prompt(name, scraped_data):
    """Generate the prompt for OpenAI to create a character persona."""
    return f"""You are creating a character persona for an interview simulation application. Based on the LinkedIn profile data below, create a rich, detailed character persona that captures this person's professional personality, communication style, and expertise.

LINKEDIN PROFILE DATA:
{scraped_data}

Create a comprehensive character persona that includes:

1. **Professional Identity**: A concise summary of who they are professionally (2-3 sentences)

2. **Personality Traits**: 3-5 key personality characteristics based on their career trajectory, roles, and achievements. Consider:
   - Are they analytical or intuitive?
   - Detail-oriented or big-picture thinker?
   - Risk-taker or cautious?
   - Collaborative or independent?
   - Fast-paced or methodical?

3. **Communication Style**: How they likely communicate in interviews (2-3 sentences). Consider:
   - Formal or casual?
   - Technical depth or accessibility?
   - Direct or diplomatic?
   - Enthusiastic or measured?

4. **Key Expertise Areas**: List 4-6 specific areas where they have deep knowledge based on their experience

5. **Notable Achievements**: 2-4 standout accomplishments from their career that they might reference

6. **Interview Behavior**: How they would likely act in an interview setting (2-3 sentences). Consider:
   - What questions they'd ask candidates
   - What they'd value in responses
   - Their assessment criteria

7. **Background Context**: Brief relevant personal/educational background that informs their perspective

Format your response as a structured JSON object with these keys:
- professional_identity (string)
- personality_traits (array of strings)
- communication_style (string)
- expertise_areas (array of strings)
- notable_achievements (array of strings)
- interview_behavior (string)
- background_context (string)
- speaking_style_notes (string) - brief notes on vocabulary, tone, pace they might use

Make the persona realistic, nuanced, and suitable for simulating an actual interview with this person. Base everything on the data provided - don't invent information that isn't supported by their profile."""


def generate_persona(client, name, scraped_data, model="gpt-4o"):
    """Generate a persona using OpenAI API."""
    try:
        prompt = generate_persona_prompt(name, scraped_data)
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing professional profiles and creating realistic character personas for interview simulations. You provide detailed, nuanced personas based on real career data."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=2000
        )
        
        persona_json = response.choices[0].message.content.strip()
        persona = json.loads(persona_json)
        
        return persona
        
    except json.JSONDecodeError as e:
        print(f"    ✗ Failed to parse JSON response: {e}")
        return None
    except Exception as e:
        print(f"    ✗ OpenAI API error: {e}")
        return None


def process_characters(input_file, output_file, model="gpt-4o", delay=1.0):
    """Process all characters in the JSON file and generate personas."""
    
    print("=" * 70)
    print("CHARACTER PERSONA GENERATION")
    print("=" * 70)
    
    # Check API key
    api_key = get_openai_api_key()
    if not api_key:
        return 1
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    # Load input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"\n✓ Loaded: {input_file}")
    except Exception as e:
        print(f"\n✗ Error loading input file: {e}")
        return 1
    
    # Filter characters
    characters = {k: v for k, v in data.items() if k.startswith('character_')}
    total = len(characters)
    
    print(f"✓ Found {total} characters to process")
    print(f"✓ Using model: {model}")
    print(f"✓ Delay between requests: {delay}s")
    
    # Process each character
    results = {
        "processed": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0
    }
    
    for idx, (char_id, char_data) in enumerate(characters.items(), 1):
        name = char_data.get('name', 'Unknown')
        character_id = char_data.get('id', char_id.split('_')[1])
        scraped_data = char_data.get('scraped_data', '')
        existing_persona = char_data.get('persona', '')
        
        print(f"\n[{idx}/{total}] {name} (ID: {character_id})")
        print("-" * 70)
        
        # Skip if no scraped data
        if not scraped_data or scraped_data.strip() == "":
            print("  ⚠ No scraped data available, skipping...")
            results["skipped"] += 1
            continue
        
        # Skip if persona already exists (unless forced)
        if existing_persona and existing_persona.strip():
            print("  ⚠ Persona already exists, skipping...")
            print(f"     (Use --force to regenerate)")
            results["skipped"] += 1
            continue
        
        # Generate persona
        print("  → Generating persona with OpenAI...")
        persona = generate_persona(client, name, scraped_data, model)
        
        if persona:
            # Update character data
            data[char_id]['persona'] = persona
            print(f"  ✓ Persona generated successfully")
            
            # Show preview
            if 'professional_identity' in persona:
                preview = persona['professional_identity'][:100]
                print(f"     Preview: {preview}...")
            
            results["success"] += 1
        else:
            print(f"  ✗ Failed to generate persona")
            results["failed"] += 1
        
        results["processed"] += 1
        
        # Rate limiting delay
        if idx < total:
            time.sleep(delay)
    
    # Save output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved output to: {output_file}")
    except Exception as e:
        print(f"\n✗ Error saving output file: {e}")
        return 1
    
    # Print summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total characters: {total}")
    print(f"Processed: {results['processed']}")
    print(f"✓ Success: {results['success']}")
    print(f"✗ Failed: {results['failed']}")
    print(f"⚠ Skipped: {results['skipped']}")
    
    # Estimate cost (GPT-4o: ~$2.50 input + $10 output per 1M tokens)
    # Rough estimate: ~2000 input + ~1000 output tokens per character
    estimated_input_tokens = results['success'] * 2000
    estimated_output_tokens = results['success'] * 1000
    estimated_cost = (estimated_input_tokens / 1_000_000 * 2.50) + \
                     (estimated_output_tokens / 1_000_000 * 10.00)
    print(f"\nEstimated cost: ~${estimated_cost:.2f}")
    
    return 0 if results["failed"] == 0 else 1


def main():
    parser = argparse.ArgumentParser(
        description='Generate character personas from LinkedIn data using OpenAI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate personas for all characters
  python generate_personas.py --input all-characters-pitch.json --output all-characters-with-personas.json
  
  # Use specific model
  python generate_personas.py --input all-characters-pitch.json --model gpt-4o-mini
  
  # Force regenerate existing personas
  python generate_personas.py --input all-characters-pitch.json --force

Setup:
  1. Get API key from https://platform.openai.com/api-keys
  2. export OPENAI_API_KEY="your_api_key_here"
  3. pip install openai

Cost: ~$0.03-0.05 per character with GPT-4o
        """
    )
    
    parser.add_argument('--input', type=str, required=True,
                       help='Input JSON file with character data')
    parser.add_argument('--output', type=str,
                       help='Output JSON file (default: overwrites input)')
    parser.add_argument('--model', type=str, default='gpt-4o',
                       choices=['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
                       help='OpenAI model to use (default: gpt-4o)')
    parser.add_argument('--delay', type=float, default=1.0,
                       help='Delay between API calls in seconds (default: 1.0)')
    parser.add_argument('--force', action='store_true',
                       help='Force regenerate existing personas')
    
    args = parser.parse_args()
    
    # Set output file
    output_file = args.output if args.output else args.input
    
    # Confirm overwrite if needed
    if not args.output and os.path.exists(args.input):
        print(f"\n⚠ Warning: This will overwrite {args.input}")
        response = input("Continue? [y/N]: ")
        if response.lower() != 'y':
            print("Cancelled.")
            return 0
    
    # Process characters
    return process_characters(args.input, output_file, args.model, args.delay)


if __name__ == "__main__":
    sys.exit(main())
