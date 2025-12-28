#!/usr/bin/env python3
"""
API Client for Character Response Backend

A friendly wrapper for interacting with the character village API.
Provides nice formatting and easy-to-use functions.

Usage:
    python api_client.py question "What should I do this weekend?"
    python api_client.py chat 5 "Tell me about your background"
    python api_client.py characters
    python api_client.py clusters
"""

import requests
import json
import sys
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


# Configuration
API_BASE_URL = "http://localhost:5037/api"
COLORS = {
    'reset': '\033[0m',
    'bold': '\033[1m',
    'dim': '\033[2m',
    'red': '\033[91m',
    'green': '\033[92m',
    'yellow': '\033[93m',
    'blue': '\033[94m',
    'magenta': '\033[95m',
    'cyan': '\033[96m',
    'white': '\033[97m',
}


def color(text: str, color_name: str) -> str:
    """Apply color to text."""
    return f"{COLORS.get(color_name, '')}{text}{COLORS['reset']}"


def print_header(text: str):
    """Print a styled header."""
    print(f"\n{color('=' * 80, 'cyan')}")
    print(color(f"  {text}", 'bold'))
    print(f"{color('=' * 80, 'cyan')}\n")


def print_section(text: str):
    """Print a section divider."""
    print(f"\n{color('─' * 80, 'blue')}")
    print(color(f"  {text}", 'yellow'))
    print(f"{color('─' * 80, 'blue')}\n")


def passion_bar(passion: float, width: int = 20) -> str:
    """Create a visual bar for passion score."""
    filled = int(passion * width)
    bar = '█' * filled + '░' * (width - filled)
    
    # Color based on passion level
    if passion >= 0.7:
        color_name = 'green'
    elif passion >= 0.4:
        color_name = 'yellow'
    else:
        color_name = 'red'
    
    return f"{color(bar, color_name)} {passion:.2f}"


class CharacterAPI:
    """Client for interacting with the Character Response API."""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request to API."""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(color(f"✗ API Error: {e}", 'red'))
            sys.exit(1)
    
    def health(self) -> Dict[str, Any]:
        """Check API health."""
        return self._request('GET', 'health')
    
    def ask_question(self, question: str, num_chars: int = 20, num_clusters: Optional[int] = None) -> Dict[str, Any]:
        """Ask the village a question."""
        return self._request('POST', 'question', json={
            'question': question,
            'num': num_chars,
            'num_clusters': num_clusters
        })
    
    def get_characters(self) -> Dict[str, Any]:
        """Get all character data."""
        return self._request('GET', 'characters')
    
    def get_character(self, char_id: int) -> Dict[str, Any]:
        """Get specific character data."""
        return self._request('GET', f'characters/{char_id}')
    
    def get_clusters(self) -> Dict[str, Any]:
        """Get cluster information."""
        return self._request('GET', 'clusters')
    
    def chat(self, char_id: int, message: str) -> Dict[str, Any]:
        """Chat with a specific character."""
        return self._request('POST', 'chat', json={
            'character_id': char_id,
            'message': message
        })
    
    def start_conversation(self, character_ids: List[int]) -> Dict[str, Any]:
        """Start a conversation between multiple characters."""
        return self._request('POST', 'conversation', json={
            'character_ids': character_ids
        })
    
    def conversation(self, num_chars: int = 5, num_exchanges: int = 3) -> Dict[str, Any]:
        """Start a conversation between characters."""
        return self._request('POST', 'conversation', json={
            'num_characters': num_chars,
            'num_exchanges': num_exchanges
        })


def display_question_results(data: Dict[str, Any]):
    """Display results from asking a question."""
    print_header(f"Question: {data['question']}")
    
    # Summary stats
    print(color("📊 Summary:", 'bold'))
    print(f"  Total Responses: {color(str(data['total']), 'cyan')}")
    print(f"  Average Passion: {passion_bar(data['average_passion'])}")
    print(f"  Clusters Found: {color(str(data['num_clusters_used']), 'cyan')}")
    
    # Clusters
    if data.get('clusters'):
        print_section("🎯 Opinion Clusters")
        
        for cluster in data['clusters']:
            cluster_title = f"Cluster {cluster['id']}: {cluster['count']} people"
            print(f"\n{color(cluster_title, 'bold')}")
            print(f"  Average Passion: {passion_bar(cluster['avg_passion'])}")
            print(f"  {color('Representative Answer:', 'yellow')} {cluster['representative_answer']}")
            
            if len(cluster['sample_responses']) > 1:
                print(f"  {color('Sample Responses:', 'dim')}")
                for response in cluster['sample_responses'][:3]:
                    print(f"    • {response}")
    
    # Outliers
    if data.get('outliers') and data['outliers']['count'] > 0:
        print_section(f"🌟 Unique Perspectives ({data['outliers']['count']} people)")
        
        for i, (char_id, answer) in enumerate(zip(
            data['outliers']['character_ids'][:5],
            data['outliers']['answers'][:5]
        )):
            char_label = f'Character {char_id}:'
            print(f"  {color(char_label, 'cyan')} {answer}")
        
        if data['outliers']['count'] > 5:
            remaining = data['outliers']['count'] - 5
            more_text = f'... and {remaining} more unique views'
            print(f"  {color(more_text, 'dim')}")
    
    # Sample character responses
    print_section("💬 Sample Character Responses")
    
    for char in data['characters'][:5]:
        name = char.get('name', 'Unknown')
        char_label = f"{name} (Character {char['id']}):"
        print(f"\n{color(char_label, 'bold')} {passion_bar(char['passion'])}")
        print(f"  {color('Quick Take:', 'yellow')} {char['short_answer']}")
        
        # Show detailed response - extract the actual content after the header
        chat_lines = char['chat'].split('\n')
        # Skip the header line and any empty lines, get the first real paragraph
        content_lines = []
        for line in chat_lines[1:]:  # Skip first line (header)
            line = line.strip()
            if line:  # Skip empty lines
                content_lines.append(line)
                if len(' '.join(content_lines)) > 150:
                    break
        
        chat = ' '.join(content_lines)
        if len(chat) > 200:
            chat = chat[:200] + "..."
        print(f"  {color('Detailed:', 'dim')} {chat}")
    
    if len(data['characters']) > 5:
        remaining = len(data['characters']) - 5
        more_text = f'... and {remaining} more responses'
        print(f"\n  {color(more_text, 'dim')}")


def display_chat_response(data: Dict[str, Any], char_id: int):
    """Display chat response from a character."""
    print_header(f"Chat with Character {char_id}")
    
    if data.get('success'):
        print(f"{color('Response:', 'bold')}\n")
        print(data['response'])
        print(f"\n{color('Passion:', 'yellow')} {passion_bar(data.get('passion', 0.5))}")
    else:
        print(color(f"✗ Error: {data.get('error', 'Unknown error')}", 'red'))


def display_characters(data: Dict[str, Any]):
    """Display character list."""
    print_header("All Characters")
    
    characters = data.get('characters', [])
    print(f"Total: {color(str(len(characters)), 'cyan')} characters\n")
    
    for char in characters[:20]:
        passion_display = passion_bar(char.get('passion', 0.0), width=10)
        cluster = f"Cluster {char['cluster_id']}" if char['cluster_id'] >= 0 else "Outlier"
        char_id_str = f"#{char['id']:2d}"
        name = char.get('name', 'Unknown')
        
        print(f"{color(char_id_str, 'cyan')} {color(name, 'bold'):30s} | {passion_display} | {color(cluster, 'yellow')}")
        if char.get('short_answer'):
            print(f"     {char['short_answer'][:70]}")
        print()
    
    if len(characters) > 20:
        print(color(f"... and {len(characters) - 20} more characters", 'dim'))


def display_clusters(data: Dict[str, Any]):
    """Display cluster information."""
    print_header("Current Clusters")
    
    clusters = data.get('clusters', [])
    
    if not clusters:
        print(color("No clusters formed yet. Ask a question first!", 'yellow'))
        return
    
    for cluster in clusters:
        cluster_title = f"Cluster {cluster['id']}: {cluster['count']} people"
        print(f"\n{color(cluster_title, 'bold')}")
        print(f"  Average Passion: {passion_bar(cluster['avg_passion'])}")
        print(f"  Representative: {cluster['representative_answer']}")


def display_character_detail(data: Dict[str, Any]):
    """Display detailed character information including full logs."""
    if not data.get('success'):
        print(color(f"✗ Error: {data.get('error', 'Unknown error')}", 'red'))
        return
    
    char = data['character']
    name = char.get('name', 'Unknown')
    char_id = char['id']
    
    print_header(f"{name} (Character #{char_id})")
    
    # Basic info
    print(f"{color('Passion Level:', 'yellow')} {passion_bar(char.get('passion', 0.0))}")
    print(f"{color('Cluster:', 'yellow')} ", end="")
    if char['cluster_id'] >= 0:
        print(f"Cluster {char['cluster_id']}")
    else:
        print("Outlier (unique perspective)")
    
    # Short answer
    if char.get('short_answer'):
        print(f"\n{color('Quick Take:', 'bold')}")
        print(f"  {char['short_answer']}")
    
    # Full conversation log
    if char.get('chat'):
        print(f"\n{color('Full Conversation Log:', 'bold')}")
        print(f"{color('─' * 80, 'dim')}")
        print(char['chat'])
        print(f"{color('─' * 80, 'dim')}")


def display_conversation(data: Dict[str, Any]):
    """Display a conversation between characters."""
    if not data.get('success'):
        print(color(f"✗ Error: {data.get('error', 'Unknown error')}", 'red'))
        return
    
    print_header(f"💬 Group Conversation")
    
    # Show participants
    participants = ', '.join(map(str, data['character_ids']))
    print(f"{color('Participants:', 'bold')} {participants}")
    print(f"{color('Question:', 'yellow')} {data.get('question', 'N/A')}\n")
    
    # Show conversation log (it's a string, not a list)
    print(f"{color('Conversation:', 'bold')}")
    print(f"{color('─' * 80, 'cyan')}\n")
    print(data['conversation_log'])
    print(f"{color('─' * 80, 'cyan')}\n")


def main():
    """CLI interface."""
    if len(sys.argv) < 2:
        print(color("Character Village API Client", 'bold'))
        print("\nUsage:")
        print(f"  {color('python api_client.py question', 'cyan')} \"Your question here\" [num_chars] [num_clusters]")
        print(f"  {color('python api_client.py chat', 'cyan')} <char_id> \"Your message\"")
        print(f"  {color('python api_client.py conversation', 'cyan')} <char_id1> <char_id2> [char_id3...]")
        print(f"  {color('python api_client.py inspect', 'cyan')} <char_id>")
        print(f"  {color('python api_client.py characters', 'cyan')}")
        print(f"  {color('python api_client.py clusters', 'cyan')}")
        print(f"  {color('python api_client.py health', 'cyan')}")
        print("\nExamples:")
        print(f"  python api_client.py question \"What should I do this weekend?\"")
        print(f"  python api_client.py question \"Should we invest in AI?\" 20 3")
        print(f"  python api_client.py chat 5 \"Tell me about your background\"")
        print(f"  python api_client.py conversation 1 2 5 8  # Characters discuss together")
        print(f"  python api_client.py inspect 1  # View full logs for Character 1")
        sys.exit(1)
    
    api = CharacterAPI()
    command = sys.argv[1].lower()
    
    try:
        if command == 'health':
            result = api.health()
            print(color("✓ API is healthy!", 'green'))
            print(json.dumps(result, indent=2))
        
        elif command == 'question':
            if len(sys.argv) < 3:
                print(color("✗ Error: Please provide a question", 'red'))
                sys.exit(1)
            
            question = sys.argv[2]
            num_chars = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            num_clusters = int(sys.argv[4]) if len(sys.argv) > 4 else None
            
            print(color(f"Asking {num_chars} characters...", 'dim'))
            result = api.ask_question(question, num_chars, num_clusters)
            display_question_results(result)
        
        elif command == 'chat':
            if len(sys.argv) < 4:
                print(color("✗ Error: Please provide character ID and message", 'red'))
                sys.exit(1)
            
            char_id = int(sys.argv[2])
            message = sys.argv[3]
            
            print(color(f"Chatting with character {char_id}...", 'dim'))
            result = api.chat(char_id, message)
            display_chat_response(result, char_id)
        
        elif command == 'characters':
            result = api.get_characters()
            display_characters(result)
        
        elif command == 'clusters':
            result = api.get_clusters()
            display_clusters(result)
        
        elif command == 'inspect':
            if len(sys.argv) < 3:
                print(color("✗ Error: Please provide a character ID", 'red'))
                sys.exit(1)
            char_id = int(sys.argv[2])
            result = api.get_character(char_id)
            display_character_detail(result)
        
        elif command == 'conversation':
            if len(sys.argv) < 4:
                print(color("✗ Error: Please provide at least 2 character IDs", 'red'))
                print("Example: python api_client.py conversation 1 2 5")
                sys.exit(1)
            character_ids = [int(arg) for arg in sys.argv[2:]]
            print(f"Starting conversation between characters: {', '.join(map(str, character_ids))}...\n")
            result = api.start_conversation(character_ids)
            display_conversation(result)
        
        else:
            print(color(f"✗ Unknown command: {command}", 'red'))
            sys.exit(1)
    
    except Exception as e:
        print(color(f"✗ Error: {e}", 'red'))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
