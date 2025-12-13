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

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    response = client.responses.create(
        model="gpt-5-nano",
        input=prompt,
    )
    return response.output_text

data = None
with open("../public/all-characters.json", "r") as f:
    data = json.load(f)

def get_character_persona(id: int) -> str:
    """Reads file at ../public/all-characters.json and returns the persona for the given id"""
    return data["characters"][f"character_{format_char_id(id)}"]["persona"]
app.state.characters_contexts = [[i + 1, 'You have this persona and are judging the pitch of a user. ' + get_character_persona(i + 1)] for i in range(20)]
app.state.user_context = [56, ""]

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

@app.post("/api/script_plan")
def get_script_plan():
    """Returns the script plan of the pitch"""
    app.state.script_plan = gpt("Generate a plan for a pitch to vcs, here is the users context: " + app.state.user_context[1] + '\n dont include any other information, just the plan, in raw text, not markdown')
    return app.state.script_plan

@app.post("/api/script")
def get_script():
    """Returns the script of the pitch"""
    app.state.pitch = gpt("Generate a script for a pitch to vcs, here is the users context: " + app.state.user_context[1] + " and here is the script plan: " + app.state.script_plan + '\n dont include any other information, just the script')

    for i in app.state.characters_contexts:
        i[1] += "Here is the users pitch: " + app.state.pitch + "\n"
    return app.state.pitch

@app.post("/api/agent_conversation")
def get_agent_conversation():
    """
    Agents discuss the pitch with each other.
    Conversation is stored back into app.state.characters_contexts.
    """

    NUM_AGENTS = 4
    ROUNDS = 2

    # choose agents
    selected_agents = random.sample(app.state.characters_contexts, NUM_AGENTS)

    conversation = []

    system_prompt = (
        "You are an audience member discussing a startup pitch you just heard.\n"
        "Stay in character. Be concise. Respond to what others say.\n"
        "Do not repeat the pitch. Do not address the user."
    )

    shared_context = "Conversation so far:\n"

    for _ in range(ROUNDS):
        for agent_id, agent_context in selected_agents:
            prompt = (
                system_prompt
                + "\n\n"
                + agent_context
                + "\n\n"
                + shared_context
                + "\nYour response:"
            )

            response = gpt(prompt).strip()

            entry = {
                "agent_id": agent_id,
                "message": response
            }
            conversation.append(entry)

            shared_context += f"\nAgent {agent_id}: {response}"

    # ---- store conversation into agent memories ----
    updated_contexts = []

    for agent_id, agent_context in app.state.characters_contexts:
        # only agents who participated get the conversation appended
        if any(agent_id == a_id for a_id, _ in selected_agents):
            agent_context += (
                "\n\nAfter the pitch, you discussed it with other audience members.\n"
                + shared_context
                + "\n"
            )

        updated_contexts.append((agent_id, agent_context))

    app.state.characters_contexts = updated_contexts

    return conversation


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")