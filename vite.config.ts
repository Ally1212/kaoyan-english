import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createBundledQuestionBankPayload } from './src/data/questionBankPayload'

function questionBankEndpoint(): Plugin {
  const createSource = () => JSON.stringify(createBundledQuestionBankPayload(), null, 2)

  return {
    name: 'question-bank-endpoint',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = (request as { url?: string }).url
        const pathname = requestUrl?.split('?')[0] ?? ''

        if (pathname !== '/question-bank.json') {
          next()
          return
        }

        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(createSource())
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'question-bank.json',
        source: createSource(),
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), questionBankEndpoint()],
})
