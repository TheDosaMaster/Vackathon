import asyncio
import datetime
import json
import random
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from starlette.routing import Route, Mount

from mcp.server import Server
from mcp.server.sse import SseServerTransport
import mcp.types as types

# Initialize FastAPI application
app = FastAPI(
    title="Python MCP Server Backend",
    description="A FastAPI server running Model Context Protocol over SSE transport",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start time for uptime calculation
START_TIME = time.time()

# Create MCP Server instance
mcp_server = Server("python-mcp-demo-server")

# Define MCP Tools
@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools for the model to invoke."""
    return [
        types.Tool(
            name="calculate",
            description="Perform basic mathematical operations (add, subtract, multiply, divide)",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {"type": "number", "description": "First number"},
                    "b": {"type": "number", "description": "Second number"},
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide"],
                        "description": "The math operation to perform"
                    }
                },
                "required": ["a", "b", "operation"]
            }
        ),
        types.Tool(
            name="get_weather",
            description="Retrieve real-time weather information for a specified location.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name or country (e.g. San Francisco, Tokyo, London)"},
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "default": "celsius",
                        "description": "Temperature unit"
                    }
                },
                "required": ["location"]
            }
        ),
        types.Tool(
            name="generate_mock_data",
            description="Generate simulated user profile details for mock testing.",
            inputSchema={
                "type": "object",
                "properties": {
                    "role": {"type": "string", "enum": ["developer", "designer", "manager", "tester"], "description": "Role of the profile"},
                    "count": {"type": "integer", "minimum": 1, "maximum": 5, "description": "Number of profiles to generate"}
                },
                "required": ["role"]
            }
        )
    ]

@mcp_server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    """Execute standard tool logic requested by the client."""
    if name == "calculate":
        a = arguments.get("a", 0)
        b = arguments.get("b", 0)
        op = arguments.get("operation", "add")
        
        if op == "add":
            res = a + b
        elif op == "subtract":
            res = a - b
        elif op == "multiply":
            res = a * b
        elif op == "divide":
            if b == 0:
                return [types.TextContent(type="text", text="Error: Division by zero is not allowed.")]
            res = a / b
        else:
            return [types.TextContent(type="text", text=f"Error: Unknown operation '{op}'")]
            
        return [types.TextContent(type="text", text=f"Result: {a} {op} {b} = {res}")]

    elif name == "get_weather":
        location = arguments.get("location", "Unknown")
        unit = arguments.get("unit", "celsius")
        
        # Simulated responses
        temp = random.randint(15, 32) if unit == "celsius" else random.randint(59, 90)
        conditions = ["Sunny", "Partly Cloudy", "Rainy", "Windy", "Clear", "Overcast"]
        condition = random.choice(conditions)
        humidity = random.randint(30, 85)
        wind_speed = random.randint(5, 25)
        
        weather_report = (
            f"Weather Report for {location.title()}:\n"
            f"- Temperature: {temp}°{unit.upper()[0]}\n"
            f"- Condition: {condition}\n"
            f"- Humidity: {humidity}%\n"
            f"- Wind Speed: {wind_speed} km/h\n"
            f"- Simulated at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return [types.TextContent(type="text", text=weather_report)]

    elif name == "generate_mock_data":
        role = arguments.get("role", "developer")
        count = min(max(arguments.get("count", 1), 1), 5)
        
        first_names = ["Alice", "Bob", "Charlie", "David", "Eva", "Frank", "Grace"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
        skills = {
            "developer": ["Python", "TypeScript", "React", "FastAPI", "Docker"],
            "designer": ["Figma", "Photoshop", "UI/UX Design", "Color Theory", "Typography"],
            "manager": ["Agile", "Scrum", "Jira", "Leadership", "Product Roadmap"],
            "tester": ["Selenium", "Jest", "PyTest", "Cypress", "Quality Assurance"]
        }
        
        profiles = []
        for _ in range(count):
            name_str = f"{random.choice(first_names)} {random.choice(last_names)}"
            user_skills = random.sample(skills[role], k=3)
            age = random.randint(22, 45)
            email = f"{name_str.lower().replace(' ', '.')}@example.com"
            profiles.append({
                "name": name_str,
                "role": role.capitalize(),
                "age": age,
                "email": email,
                "skills": user_skills
            })
            
        return [types.TextContent(type="text", text=json.dumps(profiles, indent=2))]
        
    raise ValueError(f"Unknown tool requested: {name}")

# Define MCP Resources
@mcp_server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    """Expose queryable data resources to the client."""
    return [
        types.Resource(
            uri="system://uptime",
            name="System Uptime Context",
            description="Returns current uptime and runtime details of the backend",
            mimeType="application/json"
        ),
        types.Resource(
            uri="system://facts",
            name="Random Programming Fact Generator",
            description="Exposes a stream of interesting computer science facts",
            mimeType="text/plain"
        )
    ]

@mcp_server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Retrieve raw contents for a specific resource URI."""
    if uri == "system://uptime":
        uptime_seconds = time.time() - START_TIME
        return json.dumps({
            "uptime_seconds": round(uptime_seconds, 2),
            "started_at": datetime.datetime.fromtimestamp(START_TIME).strftime('%Y-%m-%d %H:%M:%S'),
            "current_time": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "status": "healthy"
        })
    elif uri == "system://facts":
        facts = [
            "The first computer programmer was Ada Lovelace, who wrote an algorithm for Charles Babbage's Analytical Engine in 1843.",
            "Git was originally created by Linus Torvalds in 2005 to manage the development of the Linux kernel.",
            "The term 'bug' was popularized by Grace Hopper in 1947 when a literal moth was found trapped in a relay of the Harvard Mark II computer.",
            "Python was named after the British comedy group Monty Python, not the snake.",
            "Model Context Protocol (MCP) enables developers to create secure, bi-directional bridges between AI models and local or remote data sources."
        ]
        return random.choice(facts)
        
    raise ValueError(f"Unknown resource URI: {uri}")

# Define MCP Prompts
@mcp_server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    """Expose standard prompt templates for the client to use."""
    return [
        types.Prompt(
            name="refactor_code",
            description="Generate a request to refactor a block of code for better readability and performance.",
            arguments=[
                types.PromptArgument(
                    name="code",
                    description="The source code snippet that requires refactoring",
                    required=True
                ),
                types.PromptArgument(
                    name="language",
                    description="The programming language of the snippet (e.g. Python, JS)",
                    required=False
                )
            ]
        )
    ]

@mcp_server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict | None = None) -> types.GetPromptResult:
    """Evaluate and build a prompt template response."""
    if name == "refactor_code":
        args = arguments or {}
        code = args.get("code", "")
        language = args.get("language", "generic")
        
        return types.GetPromptResult(
            description=f"Refactor this {language} snippet",
            messages=[
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=(
                            f"Please refactor the following {language} code for improved readability, "
                            f"adherence to best practices, and runtime efficiency:\n\n"
                            f"```\n{code}\n```\n\n"
                            f"Provide the refactored code and list the specific improvements made."
                        )
                    )
                )
            ]
        )
        
    raise ValueError(f"Unknown prompt requested: {name}")

# Setup SSE transport.
# SseServerTransport requires the client endpoint where POST messages will be routed.
# Since we mount the post handler at "/messages", we use "/messages" as the target.
sse_transport = SseServerTransport("/messages")

@app.get("/sse")
async def handle_sse(request: Request):
    """GET endpoint that establishes the Server-Sent Events stream for the client."""
    async with sse_transport.connect_sse(
        request.scope, request.receive, request._send
    ) as (in_stream, out_stream):
        # Run the MCP server over the established input and output streams
        await mcp_server.run(
            in_stream,
            out_stream,
            mcp_server.create_initialization_options()
        )
    return Response()

# Mount the message post handler provided by the SSE transport
app.mount("/messages", sse_transport.handle_post_message)

@app.get("/")
async def root():
    """Simple health check endpoint."""
    return {
        "status": "online",
        "mcp_server": "active",
        "endpoints": {
            "sse": "/sse",
            "messages": "/messages"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
