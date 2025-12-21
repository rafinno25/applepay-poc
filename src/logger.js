/**
 * Logger utility for POC
 * Displays logs and errors in the UI for debugging purposes
 */

class Logger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.maxLogs = 500; // Maximum number of logs to keep
    this.maxErrors = 100; // Maximum number of errors to keep
  }

  /**
   * Add log entry
   * @param {string} level - Log level (INFO, REQUEST, RESPONSE, ERROR, EVENT, WARN)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.renderLog(entry);
  }

  /**
   * Add error entry
   * @param {Error|Object} error - Error object
   * @param {Object} context - Additional context
   */
  error(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      code: error.code || error.error?.code || 'UNKNOWN_ERROR',
      type: error.type || error.error?.type || 'Error',
      stack: error.stack,
      details: error.error?.details || error.details || {},
      context: context,
      fullError: error,
    };

    this.errors.push(errorEntry);

    // Keep only last maxErrors entries
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log as ERROR level (errors are shown in Test Logs, no separate error section)
    this.log('ERROR', errorEntry.message, {
      code: errorEntry.code,
      type: errorEntry.type,
      details: errorEntry.details,
      context: errorEntry.context,
    });
  }

  /**
   * Log info message
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  /**
   * Log request
   */
  request(method, url, payload = {}) {
    this.log('REQUEST', `${method} ${url}`, { payload });
  }

  /**
   * Log response
   */
  response(status, url, data = {}) {
    this.log('RESPONSE', `${status} ${url}`, { data });
  }

  /**
   * Log event
   */
  event(eventName, data = {}) {
    this.log('EVENT', eventName, data);
  }

  /**
   * Log warning
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  /**
   * Render log entry to UI
   */
  renderLog(entry) {
    const logDisplay = document.getElementById('logDisplay');
    if (!logDisplay) return;

    // Remove "No logs yet" message if present
    if (logDisplay.querySelector('p.text-gray-500')) {
      logDisplay.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';

    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = new Date(entry.timestamp).toLocaleTimeString() + ' ';

    const level = document.createElement('span');
    level.className = `log-${entry.level.toLowerCase()}`;
    level.textContent = `[${entry.level}] `;

    const message = document.createElement('span');
    message.textContent = entry.message;

    logEntry.appendChild(timestamp);
    logEntry.appendChild(level);
    logEntry.appendChild(message);

    // Add data if present
    if (Object.keys(entry.data).length > 0) {
      const dataElement = document.createElement('pre');
      dataElement.className = 'mt-2 text-xs opacity-75';
      dataElement.textContent = JSON.stringify(entry.data, null, 2);
      logEntry.appendChild(dataElement);
    }

    logDisplay.appendChild(logEntry);

    // Auto-scroll to bottom
    logDisplay.scrollTop = logDisplay.scrollHeight;
  }

  /**
   * Get all logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.errors = []; // Also clear errors when clearing logs
    const logDisplay = document.getElementById('logDisplay');
    if (logDisplay) {
      logDisplay.innerHTML = '<p class="no-logs">No logs yet. Start testing to see logs here.</p>';
    }
  }

  /**
   * Clear all errors (errors are now shown in logs, this is kept for compatibility)
   */
  clearErrors() {
    this.errors = [];
    // Errors are now shown in logs, so clearing logs will clear errors too
  }

  /**
   * Intercept fetch calls and log them
   */
  interceptFetch() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(...args) {
      const [url, options = {}] = args;
      const method = options.method || 'GET';

      // Log request
      self.request(method, url, {
        headers: options.headers,
        body: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      });

      try {
        const response = await originalFetch.apply(this, args);
        
        // Clone response to read body
        const clonedResponse = response.clone();
        let responseData = null;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            responseData = await clonedResponse.json();
          } else {
            responseData = await clonedResponse.text();
          }
        } catch (e) {
          // Ignore parsing errors
        }

        // Log response
        self.response(response.status, url, responseData);

        // If error response, also log as error
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.response = responseData;
          error.status = response.status;
          self.error(error, { url, method });
        }

        return response;
      } catch (error) {
        // Log network error
        self.error(error, { url, method });
        throw error;
      }
    };
  }
}

// Export singleton instance
export default new Logger();

