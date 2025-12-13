from fastapi import FastAPI
from pydantic import BaseModel
from fastapi import HTTPException
from fastapi.responses import RedirectResponse
import random
import json
from openai import OpenAI
import dotenv   
import os
from fastapi.middleware.cors import CORSMiddleware

dotenv.load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # or specify domains
    allow_credentials=True,
    allow_methods=["*"],          # VERY IMPORTANT
    allow_headers=["*"],
)

# Initialize OpenAI client only if API key is available
openai_api_key = os.getenv("OPENAI_API_KEY")
client = None
if openai_api_key:
    client = OpenAI(api_key=openai_api_key)

# ---- Models ----
class Context(BaseModel):
    mode: str
    context: str

class UserContext(BaseModel):
    user_context: str


def format_char_id(char_id):
    """Format character ID with leading zeros (e.g., 1 -> '0001')"""
    return str(char_id).zfill(4)

def gpt(prompt):
    """Call GPT or return dummy response if no API key"""
    if client is None:
        # Dummy response for testing without API key
        if "plan" in prompt.lower():
            return "1. Introduce yourself and your background. 2. Present the problem you are solving. 3. Explain your unique solution. 4. Show market opportunity and traction. 5. Ask for investment."
        else:
            return "Good morning everyone, thank you for having me today. I'm excited to share my vision for revolutionizing the industry. The problem we're solving affects millions of people daily. Our solution is elegant and scalable. We've already seen incredible traction with early users. We're seeking investment to accelerate growth. I'd love to answer any questions you have."
    
    response = client.responses.create(
        model="gpt-4o-mini",
        input=prompt,
    )
    return response.output_text

data = None
with open("../public/all-characters.json", "r") as f:
    data = json.load(f)

def get_character_persona(id: int) -> str:
    """Reads file at ../public/all-characters.json and returns the persona for the given id"""
    return data["characters"][f"character_{format_char_id(id)}"]["persona"]
app.state.characters_contexts = [(i + 1, get_character_persona(i + 1)) for i in range(20)]
app.state.user_context = (56, "")

# ---- Routes ----
@app.post("/api/context")
def set_context(context: Context):
    """Returns the list of agent ids"""
    return [i for i, _ in app.state.characters_contexts]

# ---- Routes ----
@app.post("/api/user_context")
def set_user_context(context: UserContext):
    """Returns the id of the user agent"""
    app.state.user_context = (56, 'A 31 year old man who wants to create a sport app that uses tech to make sports easy to track and manage.')#context.user_context)
    return app.state.user_context[0]

app.state.script_plan = ""

@app.post("/api/script_plan")
def get_script_plan():
    """Returns the transcript of the pitch"""
    app.state.script_plan = gpt("Generate a plan for a pitch to vcs, here is the users context: " + app.state.user_context[1] + '\n dont include any other information, just the plan, in raw text, not markdown')
    return app.state.script_plan

@app.post("/api/script")
def get_script():
    """Returns the script of the pitch"""
    pitch = gpt("Generate a script for a pitch to vcs, here is the users context: " + app.state.user_context[1] + " and here is the script plan: " + app.state.script_plan + '\n dont include any other information, just the script')
    return pitch

@app.post("/api/agent_conversation")
def get_agent_conversation():
    """Returns the transcript of the pitch"""
    conversations = []
    for i in range(4):
        current_conversation = set()
        while len(current_conversation) < 5:
            current_conversation.add(random.randint(1, 20))
        conversations.append(list(current_conversation))

    return [{
        "agent_003": "Today I want to pitch my idea for a new company about xyz",
    }, {
        "agent_004": "I think it's a good idea",
    }, {
        "agent_003": "Thank you",
    }, {
        "agent_004": "You're welcome",
    }]

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")