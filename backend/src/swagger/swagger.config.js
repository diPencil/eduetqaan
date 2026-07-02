// src/swagger/swagger.config.js
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'My Big Backend API', // غيّر الاسم بتاع المشروع
    version: '1.0.0',
    description: 'REST API documentation for my Node.js & Express backend',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1', // غيّر حسب البورت / السيرفر
      description: 'Local dev server',
    },
    // تقدر تزود سيرفرات تانية (staging / production)
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  // كل الفايلات اللي فيها الروتز/الكنترولرز اللي هتوثّقها
  apis: ['./src/routes/**/*.js'], // لو TS غيرها إلى ts
};

export const swaggerSpec = swaggerJSDoc(options);
