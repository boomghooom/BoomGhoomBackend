import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config/index.js';
import { database } from './config/database.js';
import { redisClient } from './config/redis.js';
import { initializeSocket } from './socket/index.js';
import routes from './api/routes/index.js';
import { errorHandler, notFoundHandler } from './api/middleware/error.middleware.js';
import { generalLimiter } from './api/middleware/rateLimit.middleware.js';
import { logger, requestLoggerFormat } from './shared/utils/logger.js';

const startServer = async (): Promise<void> => {
  try {
    // Initialize Express app
    const app = express();
    const httpServer = createServer(app);

    // Connect to databases
    await database.connect();
    await redisClient.connect();

    // Initialize Socket.IO
    const io = initializeSocket(httpServer);

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    app.use(cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Compression
    app.use(compression());

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        const userId = (req as Express.Request).userId;
        logger.info(requestLoggerFormat(
          req.method,
          req.originalUrl,
          res.statusCode,
          duration,
          userId
        ));
      });
      next();
    });

    // Rate limiting (skip in test environment)
    if (!config.isTest) {
      app.use(generalLimiter);
    }

    // Health check (before routes)
    app.get('/', (_req, res) => {
      res.json({
        success: true,
        message: 'BoomGhoom API',
        version: config.apiVersion,
        environment: config.env,
      });
    });

    // API routes
    app.use(`/api/${config.apiVersion}`, routes);

    // 404 handler
    app.use(notFoundHandler);

    // Error handler
    app.use(errorHandler);

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Close HTTP server
      httpServer.close(async () => {
        logger.info('HTTP server closed');

        // Close database connections
        await database.disconnect();
        await redisClient.disconnect();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`🚀 BoomGhoom API Server started`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🔗 URL: ${config.appUrl}/api/${config.apiVersion}`);
      logger.info(`📡 WebSocket: Ready`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();

