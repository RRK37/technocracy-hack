# Character Response Backend

A Flask API server that manages a village of 100 AI-powered characters with unique personalities. Characters can answer questions, have dynamic conversations, and maintain their state through Redis caching.

## Overview

This backend enables AI characters to:
- **Answer questions** with yes/no responses and passion scores (0.0-1.0)
- **Have group conversations** where they can change their minds based on others' opinions
- **Chat directly** with users about any topic
- **Maintain state** with conversation history stored in Redis

## Prerequisites

### Required Software
- **Python 3.8+**
- **Redis Server** - For caching character state
  - Ubuntu: `sudo apt install redis-server && redis-server`
  - Mac: `brew install redis && brew services start redis`
  - Or use a cloud Redis instance (set `REDIS_URL` environment variable)

### Environment Variables
```bash
export OPENAI_API_KEY="your-openai-api-key"
export REDIS_URL="redis://localhost:6379"  # Optional, defaults to localhost
```

### Python Dependencies
```bash
pip install -r requirements.txt
```

Required packages:
- `flask` - Web server
- `flask-cors` - CORS support
- `openai` - OpenAI API client
- `pydantic` - Data validation
- `redis` - Redis client

## Running the Server

```bash
python generateResponses.py
```

Server starts on `http://localhost:5037`

## API Endpoints

### 1. Ask a Question to All Characters
**POST** `/api/question`

Ask a question to all 100 characters simultaneously. Each character provides their answer, reasoning, and passion level.

**Request:**
```json
{
  "question": "Should we invest in renewable energy?"
}
```

**Response:**
```json
{
  "success": true,
  "question": "Should we invest in renewable energy?",
  "results": {
    "yes_count": 73,
    "no_count": 27,
    "total": 100,
    "average_passion": 0.78
  },
  "characters": [
    {
      "id": 1,
      "chat": "Alice's initial thoughts:\nI believe...\n\n",
      "answer": true,
      "passion": 0.85
    }
    // ... 99 more characters
  ]
}
```

### 2. Create a Character Conversation
**POST** `/api/conversation`

Start a dynamic conversation between selected characters. They discuss the current question, respond to each other, and may change their minds.

**Request:**
```json
{
  "character_ids": [1, 5, 10, 23]
}
```

**Response:**
```json
{
  "success": true,
  "question": "Should we invest in renewable energy?",
  "conversation_id": "42",
  "conversation_log": "Alice said:\nI think renewable energy...\n\nBob replied:\nI agree, but...\n\n",
  "character_ids": [1, 5, 10, 23],
  "characters_data": [
    {
      "id": 1,
      "chat": "Full conversation history...",
      "answer": true,
      "passion": 0.90
    }
    // ... other participants
  ]
}
```

**How it works:**
- First speaker chosen randomly, weighted by passion score
- Subsequent speakers selected randomly (excluding previous speaker)
- Minimum 3 comments, then 35% chance to end after each comment
- All participants reflect on the conversation and may update their answers

### 3. Chat Directly with a Character
**POST** `/api/chat`

Have a one-on-one conversation with a specific character.

**Request:**
```json
{
  "character_id": 5,
  "message": "What do you think about sustainability?"
}
```

**Response:**
```json
{
  "success": true,
  "character_id": 5,
  "character_name": "Alice Chen",
  "user_message": "What do you think about sustainability?",
  "character_reply": "As someone who values long-term thinking...",
  "character": {
    "id": 5,
    "chat": "Full conversation history including this exchange...",
    "answer": true,
    "passion": 0.75
  }
}
```

### 4. Get All Characters
**GET** `/api/characters`

Retrieve current state of all characters from cache.

**Response:**
```json
{
  "success": true,
  "question": "Current global question",
  "count": 100,
  "characters": [
    // Array of all 100 character objects
  ]
}
```

### 5. Get Specific Character
**GET** `/api/characters/<id>`

Get data for a single character.

**Example:** `GET /api/characters/42`

**Response:**
```json
{
  "success": true,
  "character": {
    "id": 42,
    "chat": "Character's conversation history...",
    "answer": false,
    "passion": 0.62
  }
}
```

### 6. Health Check
**GET** `/api/health`

Check if server is running.

**Response:**
```json
{
  "status": "healthy",
  "message": "Server is running"
}
```

## How It Works

### Architecture

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ HTTP Requests
       ▼
┌─────────────────────────┐
│   Flask API Server      │
│  (generateResponses.py) │
└──────┬──────────────────┘
       │
       ├──► Redis Cache (Character State)
       │
       └──► OpenAI API (GPT-4o-mini)
```

### Character Data Flow

1. **Character Profiles** loaded from `frontend/public/characters/data/all-characters.json`
   - Each has: name, persona, description

2. **Question Processing** (parallel):
   - Question sent to all 100 characters simultaneously
   - Two-stage prompting:
     - Stage 1: Initial thought generation
     - Stage 2: Structured response with answer + passion
   - Uses ThreadPoolExecutor (500 max workers)

3. **Redis Cache Structure**:
   ```
   character:1 → {id: 1, chat: "...", answer: "true", passion: "0.85"}
   character:2 → {id: 2, chat: "...", answer: "false", passion: "0.45"}
   global:question → "Current question text"
   conversation:1 → {id: 1, character_ids: "[1,5,10]", conversation_log: "..."}
   ```

4. **Conversation System**:
   - Weighted random selection (higher passion = more likely to speak)
   - Characters read previous comments before responding
   - Final reflection phase updates all participants

### Prompts System

Located in `prompts/` directory:
- `introduction.txt` - Initial character context
- `pre.txt` - Question framing
- `post.txt` - Response format instructions

## Configuration

Edit constants in generateResponses.py:

```python
CHARACTERS_PATH = Path to all-characters.json
PROMPTS_DIR = Path to prompts directory
TOTAL_CHARACTERS = 100  # Number of characters
MAX_WORKERS = 500  # Concurrent API requests
```

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (missing/invalid parameters)
- `404` - Resource not found
- `500` - Server error

## Development Notes

- Characters maintain state between requests via Redis
- Call `/api/question` first to set the global question
- Conversations and chats append to existing character state
- Server auto-initializes Redis cache on startup
- Uses Flask debug mode (auto-reload on code changes)

## Example Workflow

```bash
# 1. Ask all characters a question
curl -X POST http://localhost:5037/api/question \
  -H "Content-Type: application/json" \
  -d '{"question": "Should we ban single-use plastics?"}'

# 2. Start a conversation with characters who care most
curl -X POST http://localhost:5037/api/agent_conversation \
  -H "Content-Type: application/json" \
  -d '{"character_ids": [5, 12, 23, 67]}'

# 3. Chat with a specific character
curl -X POST http://localhost:5037/api/chat \
  -H "Content-Type: application/json" \
  -d '{"character_id": 5, "message": "Why did you change your mind?"}'

# 4. Get updated character states
curl http://localhost:5037/api/characters
```
