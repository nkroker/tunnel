import express from 'express';
import router from './routes';

const app = express();

// Use the router
app.use(router);

// ... rest of your code
