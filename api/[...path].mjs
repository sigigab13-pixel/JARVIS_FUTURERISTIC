import { handleApi } from '../server/server.mjs';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    await handleApi(req, res, url.pathname, url);
  } catch (error) {
    console.error('JARVIS Vercel API error:', error);
    if (!res.headersSent) {
      res.statusCode = Number(error?.statusCode) || 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error.',
      }));
    }
  }
}
