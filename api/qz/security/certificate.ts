import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const certificate = process.env.QZ_CERTIFICATE;

  if (!certificate) {
    return res.status(500).send('QZ certificate is not configured');
  }

  res.setHeader('Content-Type', 'text/plain');
  return res.status(200).send(certificate);
}