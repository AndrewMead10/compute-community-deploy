import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading

# Ensure thread safety for SQLite connections
local = threading.local()

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'llm_server.db')

# Ensure the data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_connection():
    """Get a thread-local SQLite connection."""
    if not hasattr(local, 'connection'):
        local.connection = sqlite3.connect(DB_PATH)
        # Enable foreign keys
        local.connection.execute("PRAGMA foreign_keys = ON")
        # Return rows as dictionaries
        local.connection.row_factory = sqlite3.Row
    return local.connection

def close_connection():
    """Close the thread-local SQLite connection if it exists."""
    if hasattr(local, 'connection'):
        local.connection.close()
        del local.connection

def init_db():
    """Initialize the database with required tables."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_admin BOOLEAN DEFAULT 0
    )
    ''')
    
    # Create usage_stats table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    
    # Create settings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
    )
    ''')
    
    conn.commit()

# User management functions
def get_users() -> List[Dict[str, Any]]:
    """Get all users from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, api_key, created_at, is_admin FROM users')
    users = [dict(row) for row in cursor.fetchall()]
    return users

def get_user_by_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """Get a user by API key."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, api_key, created_at, is_admin FROM users WHERE api_key = ?', (api_key,))
    user = cursor.fetchone()
    return dict(user) if user else None

def add_user(name: str, api_key: str, is_admin: bool = False) -> Dict[str, Any]:
    """Add a new user to the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO users (name, api_key, is_admin) VALUES (?, ?, ?)',
        (name, api_key, is_admin)
    )
    conn.commit()
    
    # Get the inserted user
    cursor.execute('SELECT id, name, api_key, created_at, is_admin FROM users WHERE id = ?', (cursor.lastrowid,))
    return dict(cursor.fetchone())

def delete_user(user_id: int) -> bool:
    """Delete a user from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    return cursor.rowcount > 0

# Usage statistics functions
def record_usage(user_id: int, endpoint: str, tokens: int = 0):
    """Record API usage for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO usage_stats (user_id, endpoint, tokens) VALUES (?, ?, ?)',
        (user_id, endpoint, tokens)
    )
    conn.commit()

def get_usage_stats() -> Dict[str, Dict[str, Any]]:
    """Get usage statistics for all users."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all users
    cursor.execute('SELECT id, name FROM users')
    users = {row['id']: row['name'] for row in cursor.fetchall()}
    
    # Get usage stats
    cursor.execute('''
    SELECT user_id, endpoint, SUM(tokens) as total_tokens, COUNT(*) as request_count, MAX(timestamp) as last_request
    FROM usage_stats
    GROUP BY user_id, endpoint
    ''')
    
    stats_rows = cursor.fetchall()
    
    # Format the results
    stats = {}
    for user_id, user_name in users.items():
        stats[user_name] = {
            "total_requests": 0,
            "total_tokens": 0,
            "last_request": None,
            "endpoints": {}
        }
    
    for row in stats_rows:
        user_id = row['user_id']
        user_name = users.get(user_id)
        if user_name:
            endpoint = row['endpoint']
            tokens = row['total_tokens']
            count = row['request_count']
            last_request = row['last_request']
            
            stats[user_name]["total_requests"] += count
            stats[user_name]["total_tokens"] += tokens
            
            if endpoint not in stats[user_name]["endpoints"]:
                stats[user_name]["endpoints"][endpoint] = 0
            stats[user_name]["endpoints"][endpoint] += count
            
            # Update last request if it's more recent
            if last_request:
                if not stats[user_name]["last_request"] or last_request > stats[user_name]["last_request"]:
                    stats[user_name]["last_request"] = last_request
    
    return stats

# Settings functions
def get_setting(key: str, default: Any = None) -> Any:
    """Get a setting from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = cursor.fetchone()
    
    if row:
        try:
            return json.loads(row['value'])
        except json.JSONDecodeError:
            return row['value']
    return default

def set_setting(key: str, value: Any):
    """Set a setting in the database."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Convert value to JSON if it's not a string
    if not isinstance(value, str):
        value = json.dumps(value)
    
    cursor.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        (key, value)
    )
    conn.commit()

# Initialize the database when the module is imported
init_db() 