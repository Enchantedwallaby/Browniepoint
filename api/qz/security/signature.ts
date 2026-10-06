import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const privateKey = process.env.QZ_PRIVATE_KEY;

  if (!privateKey) {
    return res.status(500).send('QZ private key is not configured');
  }

  const toSign =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

  try {
    const signature = crypto.sign(
      'sha512',
      Buffer.from(toSign, 'utf8'),
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      }
    );

    return res.status(200).send(signature.toString('base64'));
  } catch (error) {
    console.error('QZ signing error:', error);
    return res.status(500).send('Unable to sign QZ request');
  }
}