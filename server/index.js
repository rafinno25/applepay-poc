import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import config from './config/applepay.js';
import { errorHandler, requestIdMiddleware } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import applePayRouter from './routes/applepay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// Middleware
app.use(requestIdMiddleware);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/.well-known', express.static(join(__dirname, '../public/.well-known')));

// In production, serve built Vite assets
if (config.nodeEnv === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// API routes
app.use('/api/health', healthRouter);
app.use('/api/applepay', applePayRouter);

// Serve index.html for all non-API routes (SPA fallback)
if (config.nodeEnv === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Try multiple possible locations for index.html
    const possiblePaths = [
      join(__dirname, '../dist/index.html'),
      join(__dirname, '../dist/src/index.html'),
    ];
    
    for (const indexPath of possiblePaths) {
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    
    // If no index.html found, return error
    res.status(500).json({ error: 'index.html not found in dist directory' });
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Apple Merchant ID: ${config.appleMerchantId}`);
  console.log(`Authorize.Net Mode: ${config.authorizeNetMode}`);
});

export default app;

