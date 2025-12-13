The backend should be really simple and store anything in memory.

The flow is as so:

1.
user chooses the mode (either pitch or interview) (first focus on pitch mode)
user also gives context, about what they are pitching or interviewing about
/api/context
{
    "mode": "pitch" or "interview",
    "context": "some context about what they are pitching or interviewing about"
}
this is used to generate a list of agents, the agents are audience members each with their own persona, name, id (the ids should be within 1 to 1000), and a short description of who they are. the server sends the list of ids to the user.

2. 
the user then describes them self which the server uses to generate the user (pitcher) agent as well as a script
it then sends the pitch plan to the user
/api/userContext
{
    "userContext": "some context about the user and their background"
}

3. 
then when the server is ready it sends the transcript of the pitch and any questions to the user.
/api/get_pitch
{
    transcript: [
        {
            user: 'some text',
        },
        {
            audience_id: 1,
            text: 'some text'
        },
        {
            user: 'answer',
        },
        {
            audience_id: 2,
            text: 'some text'
        }
    ]
}
4.
while the user is watching that, the backend, makes the agents converse with each other and sends a similar transcript
/api/get_conversation
{
    transcript: [
        {
            agent_id: 1,
            text: 'some text'
        }
        {
            agent_id: 2,
            text: 'some text'
        }
    ]
}

Keep the code as simple as possible and i dont need any tests. the api should look like this