const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path - same as in Python module
const dataDir = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(dataDir, 'llm_server.db');

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create a database connection
const db = new sqlite3.Database(DB_PATH);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize the database
function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          api_key TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_admin BOOLEAN DEFAULT 0
        )
      `, (err) => {
        if (err) reject(err);
      });
      
      // Create usage_stats table
      db.run(`
        CREATE TABLE IF NOT EXISTS usage_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL,
          tokens INTEGER DEFAULT 0,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) reject(err);
      });
      
      // Create settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Create recent_models table
      db.run(`
        CREATE TABLE IF NOT EXISTS recent_models (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model_type TEXT NOT NULL, -- 'repo' or 'local'
          repo_id TEXT, -- For HuggingFace models
          gguf_file TEXT, -- For GGUF file name or local file path
          backend TEXT NOT NULL, -- 'CPU', 'CUDA', 'METAL'
          memory_settings TEXT, -- JSON string of memory settings
          display_name TEXT NOT NULL, -- Human readable name
          last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// User management functions
function getUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, api_key, created_at, is_admin FROM users', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getUserByApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, name, api_key, created_at, is_admin FROM users WHERE api_key = ?', [apiKey], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function addUser(name, apiKey, isAdmin = false) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (name, api_key, is_admin) VALUES (?, ?, ?)',
      [name, apiKey, isAdmin ? 1 : 0],
      function(err) {
        if (err) reject(err);
        else {
          // Get the inserted user
          db.get('SELECT id, name, api_key, created_at, is_admin FROM users WHERE id = ?', [this.lastID], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        }
      }
    );
  });
}

function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) reject(err);
      else resolve(this.changes > 0);
    });
  });
}

// Usage statistics functions
function getUsageStats() {
  return new Promise((resolve, reject) => {
    // First get all users
    db.all('SELECT id, name FROM users', (err, users) => {
      if (err) {
        reject(err);
        return;
      }
      
      const userMap = {};
      users.forEach(user => {
        userMap[user.id] = user.name;
      });
      
      // Then get usage stats
      db.all(`
        SELECT user_id, endpoint, SUM(tokens) as total_tokens, COUNT(*) as request_count, MAX(timestamp) as last_request
        FROM usage_stats
        GROUP BY user_id, endpoint
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Format the results
        const stats = {};
        Object.entries(userMap).forEach(([userId, userName]) => {
          stats[userName] = {
            total_requests: 0,
            total_tokens: 0,
            last_request: null,
            endpoints: {}
          };
        });
        
        rows.forEach(row => {
          const userName = userMap[row.user_id];
          if (userName) {
            const endpoint = row.endpoint;
            const tokens = row.total_tokens;
            const count = row.request_count;
            const lastRequest = row.last_request;
            
            stats[userName].total_requests += count;
            stats[userName].total_tokens += tokens;
            
            if (!stats[userName].endpoints[endpoint]) {
              stats[userName].endpoints[endpoint] = 0;
            }
            stats[userName].endpoints[endpoint] += count;
            
            // Update last request if it's more recent
            if (lastRequest) {
              if (!stats[userName].last_request || lastRequest > stats[userName].last_request) {
                stats[userName].last_request = lastRequest;
              }
            }
          }
        });
        
        resolve(stats);
      });
    });
  });
}

// Settings functions
function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        try {
          resolve(JSON.parse(row.value));
        } catch (e) {
          resolve(row.value);
        }
      } else {
        resolve(defaultValue);
      }
    });
  });
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    // Convert value to JSON if it's not a string
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    
    db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, valueToStore],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Recent models functions
function addRecentModel(modelData) {
  return new Promise((resolve, reject) => {
    const { modelType, repoId, ggufFile, backend, memorySettings, displayName } = modelData;
    
    // First check if this exact model configuration already exists
    const checkQuery = `
      SELECT id FROM recent_models 
      WHERE model_type = ? AND repo_id = ? AND gguf_file = ? AND backend = ?
    `;
    
    db.get(checkQuery, [modelType, repoId || null, ggufFile || null, backend], (err, existingRow) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (existingRow) {
        // Update the last_used timestamp for existing model
        db.run(
          'UPDATE recent_models SET last_used = CURRENT_TIMESTAMP, memory_settings = ? WHERE id = ?',
          [JSON.stringify(memorySettings), existingRow.id],
          function(err) {
            if (err) reject(err);
            else resolve(existingRow.id);
          }
        );
      } else {
        // Insert new model
        db.run(
          `INSERT INTO recent_models (model_type, repo_id, gguf_file, backend, memory_settings, display_name) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [modelType, repoId || null, ggufFile || null, backend, JSON.stringify(memorySettings), displayName],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      }
    });
  });
}

function getRecentModels(limit = null) {
  return new Promise((resolve, reject) => {
    const query = limit 
      ? 'SELECT * FROM recent_models ORDER BY last_used DESC LIMIT ?'
      : 'SELECT * FROM recent_models ORDER BY last_used DESC';
    
    const params = limit ? [limit] : [];
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Parse memory_settings JSON
        const models = rows.map(row => ({
          ...row,
          memory_settings: JSON.parse(row.memory_settings)
        }));
        resolve(models);
      }
    });
  });
}

function deleteRecentModel(modelId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM recent_models WHERE id = ?', [modelId], function(err) {
      if (err) reject(err);
      else resolve(this.changes > 0);
    });
  });
}

// Initialize the database
initDb().catch(err => {
  console.error('Error initializing database:', err);
});

// Close the database connection when the app is closed
process.on('exit', () => {
  db.close();
});

module.exports = {
  getUsers,
  getUserByApiKey,
  addUser,
  deleteUser,
  getUsageStats,
  getSetting,
  setSetting,
  addRecentModel,
  getRecentModels,
  deleteRecentModel
}; 