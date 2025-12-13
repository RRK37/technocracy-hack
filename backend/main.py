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
    if context.mode not in ['pitch']:
        raise HTTPException(status_code=400, detail="Invalid mode")

    app.state.context = context
    return {"message": "Context received successfully!"}

@app.get('/api/context')
def get_context():
    return getattr(app.state, 'context', None)

# ---- Routes ----
@app.post("/api/userContext")
def set_user_context(context: UserContext):
    app.state.user_context = context
    return {"message": "Context received successfully!"}

@app.get('/api/userContext')
def get_user_context():
    return getattr(app.state, 'user_context', None)

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")