import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

const qzSigningDirectory = fileURLToPath(new URL('./qz-tray/', import.meta.url))
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
const allowedHosts = new Set(['localhost:5173', '127.0.0.1:5173'])
const maxSignatureRequestBytes = 1024 * 1024

async function readQzSigningFile(fileName: 'digital-certificate.txt' | 'private-key.pem'): Promise<string> {
  try {
    return await readFile(resolve(qzSigningDirectory, fileName), 'utf8')
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read qz-tray/${fileName}. Copy the QZ Tray development key files into qz-tray/. ${reason}`)
  }
}

function validateQzCertificate(certificate: string): void {
  if (!/^-----BEGIN CERTIFICATE-----\r?$/m.test(certificate) || !/^-----END CERTIFICATE-----\r?$/m.test(certificate)) {
    throw new Error('qz-tray/digital-certificate.txt must contain the complete BEGIN CERTIFICATE and END CERTIFICATE lines.')
  }
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === '::1' || address === '127.0.0.1' || address?.startsWith('::ffff:127.') === true
}

function qzDevelopmentSigningPlugin(): Plugin {
  return {
    name: 'qz-development-signing',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.on('upgrade', (request, socket) => {
        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          socket.destroy()
        }
      })

      server.middlewares.use((request, response, next) => {
        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          response.end('The development server is restricted to this computer.')
          return
        }

        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        if (pathname !== '/__qz/security/certificate' && pathname !== '/__qz/security/signature') {
          next()
          return
        }

        const origin = request.headers.origin
        const host = request.headers.host?.toLowerCase()
        if (
          !host ||
          !allowedHosts.has(host) ||
          (origin !== undefined &&
            (!allowedOrigins.has(origin) || new URL(origin).host !== host))
        ) {
          console.warn(`[QZ signing] Rejected ${request.method} ${pathname}; host/origin was not an approved loopback origin.`)
          response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          response.end('QZ development signing is restricted to localhost and 127.0.0.1.')
          return
        }

        const fail = (status: number, message: string) => {
          response.writeHead(status, {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/plain; charset=utf-8',
          })
          response.end(message)
        }

        void (async () => {
          try {
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('Content-Type', 'text/plain; charset=utf-8')

            if (pathname === '/__qz/security/certificate') {
              if (request.method !== 'GET') {
                fail(405, 'Use GET to load the QZ development certificate.')
                return
              }
              const certificate = await readQzSigningFile('digital-certificate.txt')
              validateQzCertificate(certificate)
              console.info(`[QZ signing] Served development certificate (${certificate.length} characters) to ${host}.`)
              response.end(certificate)
              return
            }

            if (request.method !== 'POST') {
              fail(405, 'Use POST to sign QZ Tray requests.')
              return
            }

            const requestChunks: Buffer[] = []
            let requestBodyBytes = 0
            for await (const chunk of request) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
              requestBodyBytes += buffer.length
              if (requestBodyBytes > maxSignatureRequestBytes) {
                fail(413, 'QZ signing request exceeds the 1 MiB limit.')
                return
              }
              requestChunks.push(buffer)
            }

            const requestBody = Buffer.concat(requestChunks).toString('utf8')
            const privateKey = await readQzSigningFile('private-key.pem')
            const signer = createSign('RSA-SHA512')
            signer.update(requestBody, 'utf8')
            signer.end()
            const signature = signer.sign(privateKey, 'base64')
            console.info(`[QZ signing] Signed request (${requestBodyBytes} bytes) for ${host}.`)
            response.end(signature)
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[QZ signing] ${request.method} ${pathname} failed:`, error)
            fail(500, `QZ development signing failed: ${message}`)
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), qzDevelopmentSigningPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '::',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
})
