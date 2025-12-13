from fastapi import FastAPI
from pydantic import BaseModel
from fastapi import HTTPException
from fastapi.responses import RedirectResponse

app = FastAPI()

# ---- Models ----
class Context(BaseModel):
    mode: str
    context: str

class UserContext(BaseModel):
    user_context: str


# ---- Routes ----
@app.post("/api/context")
def set_context(context: Context):
    """Returns the list of agent ids"""
    if context.mode not in ['pitch']:
        raise HTTPException(status_code=400, detail="Invalid mode")

    app.state.context = context
    return [i for i in range(1, 21)]

# ---- Routes ----
@app.post("/api/user_context")
def set_user_context(context: UserContext):
    """Returns the id of the user agent"""
    app.state.user_context = context
    return 56

@app.post("/api/transcript")
def get_transcript():
    """Returns the transcript of the pitch"""
    return [{
        "user": "Today I want to pitch my idea for a new company about xyz",
    }, {
        "agent_003": "I think it's a good idea",
    }, {
        "user": "Thank you",
    }, {
        "agent_003": "You're welcome",
    }]

@app.post("/api/agent_conversation")
def get_agent_conversation():
    """Returns the transcript of the pitch"""
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