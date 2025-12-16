"""
Character Response Backend - Flask API for AI-powered character interactions

This server manages a village of 100 AI characters who can:
- Answer questions with yes/no responses and passion scores
- Have group conversations where they can change their minds
- Maintain conversation history in Redis cache
"""

import json
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from openai import OpenAI
from pydantic import BaseModel, ConfigDict
import redis
from flask import Flask, request, jsonify
from flask_cors import CORS
import dotenv
dotenv.load_dotenv()
# ============================================
# CONFIGURATION
# ============================================

# Character data sources (in priority order)
CHARACTERS_PITCH_PATH = Path(__file__).parent.parent / "public" / "all-characters-pitch.json"
CHARACTERS_GENERAL_PATH = Path(__file__).parent.parent / "public" / "all-characters-general.json"
CHARACTERS_FALLBACK_PATH = Path(__file__).parent.parent / "public" / "all-characters.json"
PROMPTS_DIR = Path(__file__).parent / "prompts"
TOTAL_CHARACTERS = 20
MAX_WORKERS = 500

# Cache for loaded character data to avoid repeated file reads
_characters_cache = None

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Redis client
redis_url = os.getenv("REDIS_URL")
redis_client = redis.from_url(redis_url, decode_responses=True) if redis_url else redis.Redis(
    host='localhost', port=6379, db=0, decode_responses=True
)

# ============================================
# PYDANTIC MODELS
# ============================================

class CharacterResponse(BaseModel):
    """Character profile with name and persona"""
    model_config = ConfigDict(extra="forbid")
    name: str
    persona: str

# ============================================
# HELPER FUNCTIONS
# ============================================

def format_char_id(char_id):
    """Format character ID with leading zeros (e.g., 1 -> '0001')"""
    return str(char_id).zfill(4)

def get_redis_key(char_id, prefix="character"):
    """Generate Redis key for character"""
    return f"{prefix}:{char_id}"

def load_prompts():
    """Load prompt templates from files"""
    return {
        'introduction': (PROMPTS_DIR / 'introduction.txt').read_text(),
        'pre': (PROMPTS_DIR / 'pre.txt').read_text(),
        'post': (PROMPTS_DIR / 'post.txt').read_text()
    }

# ============================================
# CHARACTER DATA ACCESS
# ============================================

def load_all_characters():
    """
    Load all characters from pitch, general, and fallback JSON files.
    Creates a unified dict mapping character IDs to character info.
    
    Returns:
        dict: {1: {'name': str, 'persona': str}, 2: {...}, ...}
    """
    global _characters_cache
    
    if _characters_cache is not None:
        return _characters_cache
    
    characters = {}
    next_id = 1
    
    # Load from pitch file (priority 1) - gets IDs 1-8
    try:
        with open(CHARACTERS_PITCH_PATH, 'r', encoding='utf-8') as f:
            pitch_data = json.load(f)
            for key in sorted([k for k in pitch_data.keys() if k.startswith('character_')]):
                char = pitch_data[key]
                if 'name' in char and 'persona' in char:
                    characters[next_id] = {
                        'name': char['name'],
                        'persona': char['persona']
                    }
                    next_id += 1
        print(f"Loaded {len(characters)} characters from pitch JSON")
    except Exception as e:
        print(f"Warning: Could not load pitch characters: {e}")
    
    # Load from general file (priority 2) - gets subsequent IDs
    try:
        with open(CHARACTERS_GENERAL_PATH, 'r', encoding='utf-8') as f:
            general_data = json.load(f)
            for key in sorted([k for k in general_data.keys() if k.startswith('character_')]):
                char = general_data[key]
                if 'name' in char and 'persona' in char:
                    characters[next_id] = {
                        'name': char['name'],
                        'persona': char['persona']
                    }
                    next_id += 1
        print(f"Total characters after general JSON: {len(characters)}")
    except Exception as e:
        print(f"Warning: Could not load general characters: {e}")
    
    # Load from fallback file (priority 3) - only if we need more characters
    try:
        with open(CHARACTERS_FALLBACK_PATH, 'r', encoding='utf-8') as f:
            fallback_data = json.load(f)
            if 'characters' in fallback_data:
                for key, char in fallback_data['characters'].items():
                    if key.startswith('character_'):
                        char_id = int(key.split('_')[1])
                        # Only add if not already loaded
                        if char_id not in characters:
                            # Fallback file might not have persona, only description
                            persona = char.get('persona', char.get('description', ''))
                            name = char.get('name', f"Character {char_id}")
                            characters[char_id] = {
                                'name': name,
                                'persona': persona
                            }
        print(f"Total characters after fallback JSON: {len(characters)}")
    except Exception as e:
        print(f"Warning: Could not load fallback characters: {e}")
    
    _characters_cache = characters
    return characters

def get_character_info(char_id):
    """
    Get character name and persona by ID.
    Loads from all-characters-pitch.json, then all-characters-general.json,
    then falls back to all-characters.json.
    
    Returns:
        dict: {'name': str, 'persona': str} or None if not found
    """
    characters = load_all_characters()
    return characters.get(char_id, None)

    ##############################################
    # REDIS CACHE OPERATIONS
    ##############################################

def init_character_cache(char_id):
    """Initialize a character in Redis with default values"""
    redis_client.hset(get_redis_key(char_id), mapping={
        'id': char_id,
        'chat': '',
        'short_answer': '',
        'passion': '0.0',
        'cluster_id': '-1'
    })

def get_character_data(char_id):
    """
    Retrieve character data from Redis
    
    Returns:
        dict with keys: id (int), chat (str), short_answer (str), passion (float), cluster_id (int)
    """
    data = redis_client.hgetall(get_redis_key(char_id))
    if not data:
        return None
    
    return {
        'id': int(data['id']),
        'chat': data['chat'],
        'short_answer': data.get('short_answer', ''),
        'passion': float(data.get('passion', '0.0')),
        'cluster_id': int(data.get('cluster_id', '-1'))
    }

def update_character_data(char_id, **kwargs):
    """Update character fields in Redis. Accepts: chat, short_answer, passion, cluster_id"""
    key = get_redis_key(char_id)
    updates = {}
    
    if 'chat' in kwargs:
        updates['chat'] = kwargs['chat']
    if 'short_answer' in kwargs:
        updates['short_answer'] = kwargs['short_answer']
    if 'passion' in kwargs:
        updates['passion'] = str(kwargs['passion'])
    if 'cluster_id' in kwargs:
        updates['cluster_id'] = str(kwargs['cluster_id'])
    
    if updates:
        redis_client.hset(key, mapping=updates)

def get_all_characters_data():
    """Get all character data from Redis, sorted by ID"""
    keys = redis_client.keys('character:*')
    characters = []
    for key in keys:
        char_id = int(key.split(':')[1])
        char_data = get_character_data(char_id)
        if char_data:
            # Add character name from character info
            char_info = get_character_info(char_id)
            if char_info:
                char_data['name'] = char_info['name']
            characters.append(char_data)
    return sorted([c for c in characters if c], key=lambda x: x['id'])

def clear_all_characters():
    """Clear all character data from Redis cache"""
    keys = redis_client.keys('character:*')
    if keys:
        redis_client.delete(*keys)

# Global question management
def set_global_question(question):
    """Store the global question in Redis"""
    redis_client.set('global:question', question)

def get_global_question():
    """Retrieve the global question from Redis"""
    return redis_client.get('global:question') or ''

# Conversation management
def save_conversation(character_ids, conversation_log):
    """Save a conversation to Redis and return conversation ID"""
    conv_id = redis_client.incr('conversation:counter')
    redis_client.hset(f"conversation:{conv_id}", mapping={
        'id': conv_id,
        'character_ids': json.dumps(character_ids),
        'conversation_log': conversation_log
    })
    return str(conv_id)

def get_conversation(conv_id):
    """Retrieve a conversation from Redis"""
    data = redis_client.hgetall(f"conversation:{conv_id}")
    if not data:
        return None
    
    return {
        'id': int(data['id']),
        'character_ids': json.loads(data['character_ids']),
        'conversation_log': data['conversation_log']
    }

def cleanAnswers():

    for i in range(1, 1001):

        # ID should be padded on the left with 0s.
        char_id = str(i)
        while (len(char_id) < 4): char_id = "0" + char_id

        # Empty the answer and short-answer files
        dir_path = f"char_x1000/character_{char_id}"
        full_path = os.path.join(dir_path, "answer.txt")
        short_path = os.path.join(dir_path, "short-answer.txt")

        # Empty the files
        open(full_path, 'w').close()
        open(short_path, 'w').close()

def query_gpt(prompt, model="gpt-4o-mini", max_tokens=150, temperature=1.2):
    """Simple GPT query for text responses"""
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": prompt}],
        max_tokens=max_tokens,
        temperature=temperature
    )
    return response.choices[0].message.content

def query_gpt_structured(prompt, schema, model="gpt-4o-mini"):
    """GPT query with structured JSON output"""
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": prompt}],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__.lower(),
                "strict": True,
                "schema": schema.model_json_schema()
            }
        },
        max_tokens=800,
        temperature=0.8
    )
    return json.loads(response.choices[0].message.content)

class CharacterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")  # This sets additionalProperties to false
    
    name: str
    persona: str

class CharacterQuestionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")  # This sets additionalProperties to false
    
    response: str  # The character's response text
    short_answer: str  # Brief answer (3-10 words)
    passion: float # Passion score from 0.0 to 1.0
    
def createNamePersona_x100():
    # Path to the JSON file
    json_path = Path(__file__).parent.parent / "public" / "all-characters.json"
    
    # Load the JSON file once
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for char_id in range(1, 101):
        # Format the character ID with leading zeros
        char_id_str = str(char_id)
        while len(char_id_str) < 4:
            char_id_str = "0" + char_id_str
        
        char_key = f"character_{char_id_str}"
        
        # Get character description
        description = data["characters"][char_key]["description"]
        
        # Create the prompt - make it more concise to fit in token limit
        prompt = f"{description}\n\nCreate a brief character profile with a name and a 2-3 sentence persona based on the description above."

        # Retry logic for API calls
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Make API call
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": prompt}
                    ],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "character_response",
                            "strict": True,
                            "schema": CharacterResponse.model_json_schema()
                        }
                    },
                    max_tokens=800,
                    temperature=0.8
                )
                
                # Parse the response
                result = json.loads(response.choices[0].message.content)
                
                # Update the character data with name and persona
                data["characters"][char_key]["name"] = result["name"]
                data["characters"][char_key]["persona"] = result["persona"]
                
                print(f"Updated {char_key}: {result['name']}")
                break  # Success, exit retry loop
                
            except json.JSONDecodeError as e:
                print(f"JSON decode error for {char_key} (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    print(f"Failed to update {char_key} after {max_retries} attempts. Skipping.")
                    data["characters"][char_key]["name"] = "Unknown"
                    data["characters"][char_key]["persona"] = "Character generation failed."
            except Exception as e:
                print(f"Unexpected error for {char_key}: {e}")
                if attempt == max_retries - 1:
                    data["characters"][char_key]["name"] = "Unknown"
                    data["characters"][char_key]["persona"] = "Character generation failed."
    
    # Save the updated JSON file
    print(f"Saving updated file to {json_path}...")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Done!")

def consider_question(question, char_id):
    """
    Get a character's response to a question with passion score
    
    Returns:
        dict: {'response': str, 'answer': bool, 'passion': float}
    """
    char_info = get_character_info(char_id)
    prompts = load_prompts()
    
    # Two-stage prompting for more thoughtful responses
    initial_thought = query_gpt(char_info['persona'] + prompts['introduction'])
    full_prompt = (
        char_info['persona'] + prompts['introduction'] + initial_thought +
        prompts['pre'] + question + prompts['post']
    )
    
    return query_gpt_structured(full_prompt, CharacterQuestionResponse)

# ============================================
# BATCH PROCESSING 
# ============================================

def blank():
    """Blank function placeholder"""
    pass

def process_character(char_id, question):
    """
    Process a single character's response to a question
    Updates Redis cache with the response, short_answer, and passion
    
    Returns:
        dict: {'response': str, 'short_answer': str, 'passion': float}
    """
    
    result = consider_question(question, char_id)
    char_info = get_character_info(char_id)
    
    # Format the chat with character's name
    formatted_chat = f"{char_info['name']}'s initial thoughts:\n{result['response']}\n\n"
    
    # Update Redis cache
    update_character_data(
        char_id,
        chat=formatted_chat,
        short_answer=result['short_answer'],
        passion=result['passion']
    )
    
    return result

def weighted_random_choice(characters_data, exclude_id=None):
    """
    Choose a character randomly with bias towards higher passion scores
    
    Args:
        characters_data: List of character dicts with 'id' and 'passion' keys
        exclude_id: Optional character ID to exclude from selection
    
    Returns:
        Selected character dict
    """
    import random
    
    # Filter out excluded character
    candidates = [c for c in characters_data if c['id'] != exclude_id]
    
    if not candidates:
        return None
    
    # Use passion scores as weights (add small base weight to avoid zero)
    weights = [c['passion'] + 0.1 for c in candidates]
    
    return random.choices(candidates, weights=weights, k=1)[0]

# ============================================
# CLUSTERING FUNCTIONS
# ============================================

def get_embeddings(texts):
    """
    Get OpenAI embeddings for a list of texts
    
    Args:
        texts: List of text strings to embed
    
    Returns:
        List of embedding vectors (lists of floats)
    """
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    import math
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

def calculate_silhouette_score(characters_data, cluster_assignments, embeddings):
    """
    Calculate average silhouette score for cluster quality
    
    Args:
        characters_data: List of character dicts
        cluster_assignments: List of cluster IDs for each character
        embeddings: List of embedding vectors
    
    Returns:
        float: Average silhouette score (-1 to 1, higher is better)
    """
    n = len(characters_data)
    if n <= 1:
        return 0.0
    
    silhouette_scores = []
    
    for i in range(n):
        if cluster_assignments[i] == -1:  # Skip outliers
            continue
        
        # Calculate average distance to points in same cluster (a)
        same_cluster = [j for j in range(n) if cluster_assignments[j] == cluster_assignments[i] and i != j]
        if not same_cluster:
            continue
        
        a = sum(1 - cosine_similarity(embeddings[i], embeddings[j]) for j in same_cluster) / len(same_cluster)
        
        # Calculate average distance to points in nearest other cluster (b)
        other_clusters = set(c for c in cluster_assignments if c != cluster_assignments[i] and c != -1)
        if not other_clusters:
            continue
        
        b_values = []
        for cluster_id in other_clusters:
            cluster_points = [j for j in range(n) if cluster_assignments[j] == cluster_id]
            if cluster_points:
                avg_dist = sum(1 - cosine_similarity(embeddings[i], embeddings[j]) for j in cluster_points) / len(cluster_points)
                b_values.append(avg_dist)
        
        if b_values:
            b = min(b_values)
            silhouette_scores.append((b - a) / max(a, b) if max(a, b) > 0 else 0)
    
    return sum(silhouette_scores) / len(silhouette_scores) if silhouette_scores else 0.0

def auto_detect_num_clusters(characters_data, embeddings, min_clusters=2, max_clusters=8):
    """
    Automatically determine optimal number of clusters using silhouette analysis
    
    Args:
        characters_data: List of character dicts with embeddings
        embeddings: List of embedding vectors
        min_clusters: Minimum number of clusters to try (default 2)
        max_clusters: Maximum number of clusters to try (default 8)
    
    Returns:
        int: Optimal number of clusters
    """
    import random
    
    n = len(characters_data)
    if n < min_clusters:
        return max(1, n // 2)
    
    # Limit max_clusters based on data size
    max_clusters = min(max_clusters, n // 3, 10)
    if max_clusters < min_clusters:
        max_clusters = min_clusters
    
    best_score = -1
    best_k = min_clusters
    
    print(f"Auto-detecting optimal clusters (trying {min_clusters}-{max_clusters})...")
    
    for k in range(min_clusters, max_clusters + 1):
        # Quick clustering with 3 iterations
        cluster_centers = random.sample(characters_data, k)
        
        for iteration in range(3):
            # Assign to nearest cluster
            for char in characters_data:
                max_similarity = -1
                best_cluster = 0
                for i, center in enumerate(cluster_centers):
                    similarity = cosine_similarity(char['embedding'], center['embedding'])
                    if similarity > max_similarity:
                        max_similarity = similarity
                        best_cluster = i
                char['temp_cluster'] = best_cluster if max_similarity >= 0.6 else -1
            
            # Update centers
            for i in range(k):
                cluster_members = [c for c in characters_data if c.get('temp_cluster') == i]
                if cluster_members:
                    mean_embedding = [
                        sum(c['embedding'][j] for c in cluster_members) / len(cluster_members)
                        for j in range(len(cluster_members[0]['embedding']))
                    ]
                    best_char = max(cluster_members, 
                                  key=lambda c: cosine_similarity(c['embedding'], mean_embedding))
                    cluster_centers[i] = best_char
        
        # Calculate silhouette score
        cluster_assignments = [c['temp_cluster'] for c in characters_data]
        score = calculate_silhouette_score(characters_data, cluster_assignments, embeddings)
        
        print(f"  k={k}: silhouette score = {score:.3f}")
        
        if score > best_score:
            best_score = score
            best_k = k
    
    print(f"✓ Optimal clusters: {best_k} (score: {best_score:.3f})")
    return best_k

def cluster_answers(characters_data, num_clusters=None, similarity_threshold=0.6):
    """
    Cluster character answers using embeddings and k-means-like approach
    
    Args:
        characters_data: List of character dicts with 'id', 'short_answer', 'passion'
        num_clusters: Number of theme clusters to create (None = auto-detect)
        similarity_threshold: Minimum similarity to belong to a cluster (default 0.6)
    
    Returns:
        dict: {
            'clusters': [{'id': int, 'representative_answer': str, 'character_ids': [int], 
                          'count': int, 'avg_passion': float, 'sample_responses': [str]}],
            'outliers': {'character_ids': [int], 'count': int, 'answers': [str]},
            'num_clusters': int  # Actual number used (for auto-detection feedback)
        }
    """
    import random
    
    # Filter out characters with no short_answer
    valid_chars = [c for c in characters_data if c.get('short_answer', '').strip()]
    
    if not valid_chars:
        return {'clusters': [], 'outliers': {'character_ids': [], 'count': 0, 'answers': []}, 'num_clusters': 0}
    
    # Get embeddings for all short answers
    short_answers = [c['short_answer'] for c in valid_chars]
    embeddings = get_embeddings(short_answers)
    
    # Attach embeddings to character data
    for i, char in enumerate(valid_chars):
        char['embedding'] = embeddings[i]
    
    # Auto-detect optimal number of clusters if not specified
    if num_clusters is None:
        num_clusters = auto_detect_num_clusters(valid_chars, embeddings)
    else:
        # Ensure num_clusters is valid
        if len(valid_chars) < num_clusters:
            num_clusters = max(1, len(valid_chars) // 2)
            print(f"Adjusted clusters to {num_clusters} based on available data")
    
    # Initialize cluster centers by randomly selecting characters
    cluster_centers = random.sample(valid_chars, num_clusters)
    
    # K-means clustering (5 iterations)
    for iteration in range(5):
        # Assign each character to nearest cluster
        for char in valid_chars:
            max_similarity = -1
            best_cluster = 0
            for i, center in enumerate(cluster_centers):
                similarity = cosine_similarity(char['embedding'], center['embedding'])
                if similarity > max_similarity:
                    max_similarity = similarity
                    best_cluster = i
            
            # Check if similarity meets threshold
            if max_similarity >= similarity_threshold:
                char['temp_cluster'] = best_cluster
            else:
                char['temp_cluster'] = -1  # Outlier
        
        # Update cluster centers (find character closest to mean)
        for i in range(num_clusters):
            cluster_members = [c for c in valid_chars if c.get('temp_cluster') == i]
            if cluster_members:
                # Calculate mean embedding
                mean_embedding = [
                    sum(c['embedding'][j] for c in cluster_members) / len(cluster_members)
                    for j in range(len(cluster_members[0]['embedding']))
                ]
                
                # Find character closest to mean
                best_char = None
                best_sim = -1
                for char in cluster_members:
                    sim = cosine_similarity(char['embedding'], mean_embedding)
                    if sim > best_sim:
                        best_sim = sim
                        best_char = char
                
                if best_char:
                    cluster_centers[i] = best_char
    
    # Build final cluster results
    clusters = []
    for i in range(num_clusters):
        cluster_members = [c for c in valid_chars if c.get('temp_cluster') == i]
        if cluster_members:
            clusters.append({
                'id': i,
                'representative_answer': cluster_centers[i]['short_answer'],
                'character_ids': [c['id'] for c in cluster_members],
                'count': len(cluster_members),
                'avg_passion': sum(c['passion'] for c in cluster_members) / len(cluster_members),
                'sample_responses': [c['short_answer'] for c in cluster_members[:3]]  # First 3
            })
    
    # Collect outliers
    outliers = [c for c in valid_chars if c.get('temp_cluster') == -1]
    outlier_result = {
        'character_ids': [c['id'] for c in outliers],
        'count': len(outliers),
        'answers': [c['short_answer'] for c in outliers]
    }
    
    return {
        'clusters': sorted(clusters, key=lambda x: x['count'], reverse=True),
        'outliers': outlier_result,
        'num_clusters': num_clusters
    }

def save_cluster_results(cluster_data):
    """
    Save cluster results to Redis and update character cluster_ids
    
    Args:
        cluster_data: Result from cluster_answers()
    """
    # Clear old cluster data
    old_keys = redis_client.keys('cluster:*')
    if old_keys:
        redis_client.delete(*old_keys)
    
    # Save each cluster
    for cluster in cluster_data['clusters']:
        redis_client.hset(f"cluster:{cluster['id']}", mapping={
            'id': cluster['id'],
            'representative_answer': cluster['representative_answer'],
            'character_ids': json.dumps(cluster['character_ids']),
            'count': cluster['count'],
            'avg_passion': str(cluster['avg_passion']),
            'sample_responses': json.dumps(cluster['sample_responses'])
        })
        
        # Update each character's cluster_id
        for char_id in cluster['character_ids']:
            update_character_data(char_id, cluster_id=cluster['id'])
    
    # Update outliers
    for char_id in cluster_data['outliers']['character_ids']:
        update_character_data(char_id, cluster_id=-1)
    
    # Save outlier metadata
    if cluster_data['outliers']['character_ids']:
        redis_client.hset('cluster:outliers', mapping={
            'character_ids': json.dumps(cluster_data['outliers']['character_ids']),
            'count': cluster_data['outliers']['count'],
            'answers': json.dumps(cluster_data['outliers']['answers'])
        })

def get_cluster_results():
    """
    Retrieve all cluster data from Redis
    
    Returns:
        dict with 'clusters' and 'outliers' keys
    """
    cluster_keys = [k for k in redis_client.keys('cluster:*') if k != 'cluster:outliers']
    
    clusters = []
    for key in cluster_keys:
        data = redis_client.hgetall(key)
        clusters.append({
            'id': int(data['id']),
            'representative_answer': data['representative_answer'],
            'character_ids': json.loads(data['character_ids']),
            'count': int(data['count']),
            'avg_passion': float(data['avg_passion']),
            'sample_responses': json.loads(data['sample_responses'])
        })
    
    # Get outliers
    outlier_data = redis_client.hgetall('cluster:outliers')
    outliers = {
        'character_ids': json.loads(outlier_data.get('character_ids', '[]')),
        'count': int(outlier_data.get('count', '0')),
        'answers': json.loads(outlier_data.get('answers', '[]'))
    }
    
    return {
        'clusters': sorted(clusters, key=lambda x: x['count'], reverse=True),
        'outliers': outliers
    }

def get_first_speaker_response(char_id):
    """Get response from first speaker in conversation"""
    char_info = get_character_info(char_id)
    char_data = get_character_data(char_id)
    question = get_global_question()
    
    prompt = f"""{char_info['persona']}

{char_data['chat']}

The question being discussed is: {question}

You are now talking to other people about this question. Share your thoughts in a conversational way. Keep your response under 100 words."""
    
    return query_gpt(prompt, max_tokens=200)

def get_reply_response(char_id):
    """Get response from character replying to previous comment"""
    char_info = get_character_info(char_id)
    char_data = get_character_data(char_id)
    question = get_global_question()
    
    prompt = f"""{char_info['persona']}

{char_data['chat']}

The question being discussed is: {question}

You are replying to the previous person's comment. Share your thoughts in response. Keep your response under 100 words."""
    
    return query_gpt(prompt, max_tokens=200)

def get_final_reflection(char_id):
    """Get character's final thoughts after conversation"""
    char_info = get_character_info(char_id)
    char_data = get_character_data(char_id)
    question = get_global_question()
    
    prompt = f"""{char_info['persona']}

{char_data['chat']}

The question is: {question}

After this conversation, what are your final thoughts on the question? Provide your answer (yes/no), reasoning, and passion level."""
    
    return query_gpt_structured(prompt, CharacterQuestionResponse)

def get_direct_response(char_id, user_message):
    """Get character's response to a direct user question"""
    char_info = get_character_info(char_id)
    char_data = get_character_data(char_id)
    
    prompt = f"""{char_info['persona']}

{char_data['chat']}

A user is asking you: {user_message}

As {char_info['name']}, respond directly to the user's question. Keep your response conversational and under 150 words."""
    
    return query_gpt(prompt, max_tokens=300)

def prompt_characters(question, num=TOTAL_CHARACTERS, num_clusters=None):
    """
    Ask a question to multiple characters in parallel and cluster their answers
    
    Args:
        question: The question to ask
        num: Number of characters to query
        num_clusters: Number of theme clusters (None = auto-detect, default)
    
    Returns:
        dict: cluster results with themes and character groupings
    """
    total_passion = 0.0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_char = {
            executor.submit(process_character, i, question): i 
            for i in range(1, num + 1)
        }
        
        for future in as_completed(future_to_char):
            char_id = future_to_char[future]
            try:
                result = future.result()
                total_passion += result['passion']
                print(f"Character {char_id} completed: {result['short_answer']} (passion: {result['passion']:.2f})")
            except Exception as exc:
                print(f"Character {char_id} generated an exception: {exc}")
    
    # Get all character data and cluster answers
    characters_data = get_all_characters_data()
    cluster_results = cluster_answers(characters_data, num_clusters=num_clusters)
    
    # Save cluster results to Redis
    save_cluster_results(cluster_results)
    
    return {
        'total': num,
        'average_passion': total_passion / num if num > 0 else 0.0,
        'clusters': cluster_results['clusters'],
        'outliers': cluster_results['outliers'],
        'num_clusters_used': cluster_results['num_clusters']
    }

# ============================================
# FLASK API ROUTES
# ============================================

app = Flask(__name__)
CORS(app)

# Route 1: Handle "question" requests
# This endpoint receives a question and asks multiple characters
@app.route('/api/question', methods=['POST'])
def handle_question():
    """
    Expects JSON like:
    {
        "question": "What should I do this weekend?",
        "num_clusters": null  // optional: null = auto-detect (default), or specific number
    }
    """
    try:
        # Get the data sent from the frontend
        data = request.json
        question = data.get('question')
        num_clusters = data.get('num_clusters', None)  # None triggers auto-detection

        # Validate input
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Store the global question in Redis
        set_global_question(question)
        results = prompt_characters(question, TOTAL_CHARACTERS, num_clusters=num_clusters)
        
        # Get all cached character data
        cached_data = get_all_characters_data()
        
        # Send back the results as JSON with cluster information
        return jsonify({
            'success': True,
            'question': get_global_question(),
            'total': results['total'],
            'average_passion': results['average_passion'],
            'num_clusters_used': results['num_clusters_used'],
            'clusters': results['clusters'],
            'outliers': results['outliers'],
            'characters': cached_data  # Include all character data from cache
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Route 2: Handle "conversation" requests
# This endpoint can be used for back-and-forth conversation with characters
@app.route('/api/conversation', methods=['POST'])
def handle_conversation():
    """
    Expects JSON like:
    {
        "character_ids": [1, 5, 10, 23]  # Array of character IDs
    }
    
    Creates a dynamic conversation between characters with weighted random selection.
    """
    import random
    
    try:
        # Get the data sent from the frontend
        data = request.json
        character_ids = data.get('character_ids', [])
        
        # Validate input
        if not character_ids or not isinstance(character_ids, list):
            return jsonify({'error': 'character_ids must be a non-empty array'}), 400
        
        # Get data from Redis for each character
        characters_data = []
        for char_id in character_ids:
            char_data = get_character_data(char_id)
            if char_data:
                characters_data.append(char_data)
        
        if not characters_data:
            return jsonify({'error': 'No valid characters found'}), 404
        
        question = get_global_question()
        
        # Start conversation log
        conversation_log = []
        
        # Choose first speaker (weighted random by passion)
        current_speaker = weighted_random_choice(characters_data)
        last_speaker_id = None
        
        # First speaker
        char_info = get_character_info(current_speaker['id'])
        response_text = get_first_speaker_response(current_speaker['id'])
        conversation_log.append({
            'character_id': current_speaker['id'],
            'character_name': char_info['name'],
            'text': response_text
        })
        last_speaker_id = current_speaker['id']
        
        # Continue conversation with subsequent speakers (4 total comments)
        comment_count = 1
        while comment_count < 4:
            # Append latest comment to all participants' chats (temporary for this conversation)
            for char_id in character_ids:
                current_chat = get_character_data(char_id)['chat']
                latest_comment = conversation_log[-1]
                temp_chat = f"{current_chat}\nConversation:\n\n{latest_comment['character_name']} said:\n{latest_comment['text']}\n"
                update_character_data(char_id, chat=temp_chat)
            
            # Choose next speaker (exclude last speaker)
            next_speaker = weighted_random_choice(characters_data, exclude_id=last_speaker_id)
            if not next_speaker:
                break
            
            # Get response from next speaker
            char_info = get_character_info(next_speaker['id'])
            response_text = get_reply_response(next_speaker['id'])
            conversation_log.append({
                'character_id': next_speaker['id'],
                'character_name': char_info['name'],
                'text': response_text
            })
            last_speaker_id = next_speaker['id']
            comment_count += 1
        
        # Build final conversation text
        conversation_text = ""
        for entry in conversation_log:
            conversation_text += f"{entry['character_name']} said:\n{entry['text']}\n\n"
        
        # Update all participants with final conversation and get reflections
        updated_characters = []
        for char_id in character_ids:
            # Get original initial thoughts (before conversation updates)
            char_info = get_character_info(char_id)
            original_data = get_character_data(char_id)
            
            # Extract just the initial thoughts (first part before any "Conversation:")
            initial_thoughts = original_data['chat'].split('\nConversation:')[0]
            
            # Get final reflection
            reflection = get_final_reflection(char_id)
            
            # Build final chat format
            final_chat = f"{initial_thoughts}\nConversation:\n\n{conversation_text}{char_info['name']} thought:\n{reflection['response']}\n\n"
            
            # Update Redis with final state
            update_character_data(
                char_id,
                chat=final_chat,
                short_answer=reflection['short_answer'],
                passion=reflection['passion']
            )
            
            # Get updated character data
            updated_char = get_character_data(char_id)
            updated_characters.append(updated_char)
        
        # Re-cluster all answers after conversation (characters may have changed their minds)
        all_characters_data = get_all_characters_data()
        cluster_results = cluster_answers(all_characters_data, num_clusters=None)  # Auto-detect
        save_cluster_results(cluster_results)
        
        # Save the conversation to Redis
        conv_id = save_conversation(character_ids, conversation_text)
        
        return jsonify({
            'success': True,
            'question': question,
            'conversation_id': conv_id,
            'conversation_log': conversation_text,
            'character_ids': character_ids,
            'characters_data': updated_characters,
            'clusters': cluster_results['clusters'],
            'outliers': cluster_results['outliers']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Health check endpoint (useful to test if server is running)
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Server is running'}), 200


# Route 3: Get all cached character data
@app.route('/api/characters', methods=['GET'])
def get_characters():
    """
    Get all character data from Redis cache.
    Useful for checking the current state of all characters.
    """
    try:
        characters = get_all_characters_data()
        return jsonify({
            'success': True,
            'question': get_global_question(),
            'count': len(characters),
            'characters': characters
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Route 3b: Get cluster information
@app.route('/api/clusters', methods=['GET'])
def get_clusters():
    """
    Get current cluster information without full character data.
    Returns cluster themes, counts, and which characters belong to each.
    """
    try:
        cluster_data = get_cluster_results()
        
        return jsonify({
            'success': True,
            'question': get_global_question(),
            'num_clusters': len(cluster_data['clusters']),
            'clusters': cluster_data['clusters'],
            'outliers': cluster_data['outliers']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Route 4: Get specific character data
@app.route('/api/characters/<int:char_id>', methods=['GET'])
def get_character(char_id):
    """
    Get data for a specific character from Redis cache.
    """
    try:
        character = get_character_data(char_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404
        
        return jsonify({
            'success': True,
            'character': character
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Route 5: Direct chat with a specific character
@app.route('/api/chat', methods=['POST'])
def chat_with_character():
    """
    Expects JSON like:
    {
        "character_id": 5,
        "message": "What do you think about sustainability?"
    }
    
    Allows direct interaction with a specific character.
    """
    try:
        # Get the data sent from the frontend
        data = request.json
        char_id = data.get('character_id')
        user_message = data.get('message')
        
        # Validate input
        if not char_id or not user_message:
            return jsonify({'error': 'character_id and message are required'}), 400
        
        # Check if character exists
        char_data = get_character_data(char_id)
        if not char_data:
            return jsonify({'error': 'Character not found'}), 404
        
        # Get character info
        char_info = get_character_info(char_id)
        
        # Get character's response
        character_reply = get_direct_response(char_id, user_message)
        
        # Update chat with user question and character reply
        current_chat = char_data['chat']
        updated_chat = f"{current_chat}\nuser asked:\n{user_message}\n\n{char_info['name']} replied:\n{character_reply}\n\n"
        
        # Update Redis
        update_character_data(char_id, chat=updated_chat)
        
        # Get updated character data
        updated_character = get_character_data(char_id)
        
        return jsonify({
            'success': True,
            'character_id': char_id,
            'character_name': char_info['name'],
            'user_message': user_message,
            'character_reply': character_reply,
            'character': updated_character
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# SERVER INITIALIZATION
# ============================================

def init_server():
    """Initialize Redis and character cache"""
    try:
        redis_client.ping()
        print("✓ Redis connection successful")
    except redis.ConnectionError:
        print("✗ Redis connection failed! Make sure Redis server is running:")
        print("  Install: sudo apt install redis-server (Ubuntu) or brew install redis (Mac)")
        print("  Start: redis-server")
        sys.exit(1)
    
    # Load character data to show available count
    print("\nLoading character data from JSON files...")
    characters = load_all_characters()
    available_chars = len(characters)
    print(f"✓ Found {available_chars} characters with personas")
    
    # Use the minimum of TOTAL_CHARACTERS or available characters
    chars_to_init = min(TOTAL_CHARACTERS, available_chars)
    print(f"\nInitializing {chars_to_init} characters in Redis cache...")
    clear_all_characters()
    set_global_question('')
    
    for i in range(1, chars_to_init + 1):
        if i in characters:
            init_character_cache(i)
    
    print(f"✓ Initialized {len(get_all_characters_data())} characters")
    print("\nStarting Flask server on http://localhost:5037")
    print("Available endpoints:")
    print("  POST /api/question - Ask the village a question")
    print("  POST /api/conversation - Have a conversation with characters")
    print("  POST /api/chat - Chat directly with a specific character")
    print("  GET  /api/clusters - Get current cluster information")
    print("  GET  /api/characters - Get all cached character data")
    print("  GET  /api/characters/<id> - Get specific character data")
    print("  GET  /api/health - Check if server is running")

if __name__ == '__main__':
    # Only run initialization in the main process (not the reloader child)
    if not (sys.argv[0].endswith('flask') or os.environ.get('WERKZEUG_RUN_MAIN')):
        pass  # Reloader parent process, skip initialization
    else:
        init_server()
    
    app.run(debug=True, host='0.0.0.0', port=5037)

