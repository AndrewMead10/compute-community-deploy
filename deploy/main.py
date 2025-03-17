from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional, Dict, List, Any
import json
import os
import time
from datetime import datetime
import httpx
import asyncio
import sys

# Add the parent directory to the Python path to import the shared module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared import database

# Create FastAPI app
app = FastAPI(title="LLM API Middleware")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Function to validate API key
async def validate_api_key(authorization: str = Header(None, description="Optional Authorization header with Bearer token")):
    print(f"Authorization header: {authorization}")
    if not authorization:
        return None  # No API key provided, but that's allowed now
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header. Must be 'Bearer {api_key}'")
    
    api_key = authorization.replace("Bearer ", "")
    user = database.get_user_by_api_key(api_key)
    print(user)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return api_key

# Middleware to track usage
@app.middleware("http")
async def track_usage(request: Request, call_next):
    # Skip tracking for non-API endpoints
    if not request.url.path.startswith("/v1"):
        return await call_next(request)
    
    # Get API key from Authorization header
    authorization = request.headers.get("Authorization")
    user_id = None
    endpoint = request.url.path
    
    # If authorization header is present, validate the API key
    if authorization:
        if not authorization.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header. Must be 'Bearer {api_key}'"}
            )
        
        api_key = authorization.replace("Bearer ", "")
        
        # Validate API key
        user = database.get_user_by_api_key(api_key)
        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid API key"}
            )
        
        user_id = user["id"]
        
        # Track endpoint usage
        database.record_usage(user_id, endpoint, 0)  # Initial record with 0 tokens
    
    # Process the request
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Add processing time to response headers
    response.headers["X-Process-Time"] = str(process_time)
    
    # We'll handle token usage tracking in the proxy endpoint
    return response

# Proxy route for all llama-cpp-python server endpoints
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_endpoint(request: Request, path: str, api_key: Optional[str] = Depends(validate_api_key)):
    # Get user from API key if provided
    user = None
    user_id = None
    if api_key:
        user = database.get_user_by_api_key(api_key)
        if user:
            user_id = user["id"]
    
    # Get request body if any
    body = None
    is_streaming = False
    
    if request.method in ["POST", "PUT"]:
        body = await request.body()
        
        # Check if this is a streaming request for completions endpoints
        if request.method == "POST" and path in ["v1/completions", "v1/chat/completions"]:
            try:
                body_json = json.loads(body)
                is_streaming = body_json.get("stream", False)
            except Exception as e:
                print(f"Error parsing request body: {e}")
    
    # Forward the request to the llama-cpp-python server
    client = httpx.AsyncClient(base_url="http://localhost:8000")
    
    # Forward the request
    try:
        # Create headers dictionary without host and Authorization
        headers = {key: value for key, value in request.headers.items() 
                  if key.lower() != "host" and key.lower() != "authorization"}
        
        response = await client.request(
            method=request.method,
            url=f"/{path}",
            headers=headers,
            content=body,
            params=request.query_params,
        )
        
        # For streaming responses, we need to return the response as a stream
        if is_streaming:
            from fastapi.responses import StreamingResponse
            
            # For streaming, we can't easily track token usage
            # Just return the streaming response
            return StreamingResponse(
                content=response.aiter_bytes(),
                status_code=response.status_code,
                headers=dict(response.headers)
            )
        else:
            # For non-streaming responses, we can track token usage
            response_data = response.json() if response.content else None
            
            # Track token usage if this is a completion request and we have a user_id
            if user_id and path in ["v1/completions", "v1/chat/completions"] and response_data and "usage" in response_data:
                if "total_tokens" in response_data["usage"]:
                    tokens = response_data["usage"]["total_tokens"]
                    # Record token usage
                    database.record_usage(user_id, f"/{path}", tokens)
            
            # Return the response
            return JSONResponse(
                content=response_data,
                status_code=response.status_code,
                headers=dict(response.headers)
            )
    except Exception as e:
        print(f"Error forwarding request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error forwarding request: {str(e)}"}
        )
    finally:
        await client.aclose()

# Endpoint to get usage statistics
@app.get("/admin/usage", response_model=Dict[str, Any])
async def get_usage_stats(api_key: Optional[str] = Depends(validate_api_key)):
    # Ensure API key is provided for admin endpoints
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required for admin endpoints")
    
    # Get user from API key
    user = database.get_user_by_api_key(api_key)
    
    # In a real app, you'd check if the user has admin privileges
    # For now, we'll just return the usage stats for all users
    return database.get_usage_stats()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)

