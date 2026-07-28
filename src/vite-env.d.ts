/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUESTION_BANK_URL?: string
  readonly VITE_SENTENCE_BANK_URL?: string
  readonly VITE_VOCABULARY_BANK_URL?: string
  readonly VITE_DICTIONARY_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
