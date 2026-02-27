import { readFileSync } from 'fs'
import { PDFParse } from 'pdf-parse'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { OpenAIEmbeddings } from '@langchain/openai'
import { VectorStore } from '@langchain/core/vectorstores'
import type { EmbeddingsInterface } from '@langchain/core/embeddings'
import type { DocumentInterface } from '@langchain/core/documents'
import { HumanMessage, type BaseMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export class MemoryVectorStore extends VectorStore {
  private vectors: number[][] = []
  private documents: DocumentInterface[] = []

  _vectorstoreType(): string {
    return 'memory'
  }

  async addVectors(vectors: number[][], documents: DocumentInterface[]): Promise<void> {
    this.vectors.push(...vectors)
    this.documents.push(...documents)
  }

  async addDocuments(documents: DocumentInterface[]): Promise<void> {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((d) => d.pageContent)
    )
    await this.addVectors(vectors, documents)
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[DocumentInterface, number][]> {
    const scored: [DocumentInterface, number][] = this.documents.map((doc, i) => [
      doc,
      cosineSimilarity(query, this.vectors[i])
    ])
    scored.sort((a, b) => b[1] - a[1])
    return scored.slice(0, k)
  }

  static async fromDocuments(
    docs: DocumentInterface[],
    embeddings: EmbeddingsInterface
  ): Promise<MemoryVectorStore> {
    const store = new MemoryVectorStore(embeddings)
    await store.addDocuments(docs)
    return store
  }
}

export type ClarityState = {
  messages: BaseMessage[]
  uploaded_pdfs: string[]
  vectorstore: MemoryVectorStore | null
  retrieved_context: string | null
  original_prompt: string
}

let sessionVectorStore: MemoryVectorStore | null = null
const indexedPaths = new Set<string>()

function getOnStatus(config?: RunnableConfig): (s: string) => void {
  return (config?.configurable?.onStatus as (s: string) => void) ?? (() => {})
}

export async function checkAttachments(
  state: ClarityState,
  config?: RunnableConfig
): Promise<Partial<ClarityState>> {
  const onStatus = getOnStatus(config)
  onStatus('Checking for attachments...')
  return {}
}

export function routeFromCheckAttachments(state: ClarityState): string {
  const pdfs = state.uploaded_pdfs ?? []
  if (pdfs.length === 0) return 'agent'

  const hasNewPdfs = pdfs.some((p) => !indexedPaths.has(p))
  if (hasNewPdfs) return 'chunk_and_index'

  return 'retrieve_context'
}

export async function chunkAndIndex(
  state: ClarityState,
  config?: RunnableConfig
): Promise<Partial<ClarityState>> {
  const onStatus = getOnStatus(config)
  onStatus('Parsing PDFs...')

  const newPdfs = (state.uploaded_pdfs ?? []).filter((p) => !indexedPaths.has(p))

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50
  })

  const allDocs: Awaited<ReturnType<typeof splitter.createDocuments>> = []

  for (const pdfPath of newPdfs) {
    try {
      const buffer = readFileSync(pdfPath)
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      const docs = await splitter.createDocuments([result.text], [{ source: pdfPath }])
      allDocs.push(...docs)
      indexedPaths.add(pdfPath)
      await parser.destroy()
    } catch (err) {
      console.error(`Failed to parse PDF: ${pdfPath}`, err)
    }
  }

  if (allDocs.length === 0) {
    return { vectorstore: sessionVectorStore }
  }

  onStatus(`Indexing ${allDocs.length} chunks...`)

  const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY })

  if (!sessionVectorStore) {
    sessionVectorStore = await MemoryVectorStore.fromDocuments(allDocs, embeddings)
  } else {
    await sessionVectorStore.addDocuments(allDocs)
  }

  return { vectorstore: sessionVectorStore }
}

const DOCUMENT_CENTRIC_PATTERN =
  /this document|the pdf|based on this|in the file|the document|uploaded|attached|from the pdf|in this pdf/i

export async function retrieveContext(
  state: ClarityState,
  config?: RunnableConfig
): Promise<Partial<ClarityState>> {
  const onStatus = getOnStatus(config)
  onStatus('Searching documents...')

  const store = sessionVectorStore
  if (!store) {
    return { retrieved_context: null }
  }

  const prompt = state.original_prompt
  const isDocCentric = DOCUMENT_CENTRIC_PATTERN.test(prompt)

  const k = isDocCentric ? 8 : 5
  const results = await store.similaritySearchWithScore(prompt, k)

  let filtered = results
  if (!isDocCentric) {
    filtered = results.filter(([, score]) => score >= 0.3)
  }

  if (filtered.length === 0) {
    return { retrieved_context: null }
  }

  const context = filtered.map(([doc]) => doc.pageContent).join('\n\n')
  return { retrieved_context: context }
}

export function routeFromRetrieveContext(state: ClarityState): string {
  return state.retrieved_context ? 'augment_prompt' : 'agent'
}

export async function augmentPrompt(
  state: ClarityState,
  config?: RunnableConfig
): Promise<Partial<ClarityState>> {
  const onStatus = getOnStatus(config)
  onStatus('Augmenting prompt with document context...')

  const lastHuman = [...state.messages]
    .reverse()
    .find((m) => m._getType() === 'human') as HumanMessage | undefined

  if (!lastHuman) return {}

  const augmentedContent = `Use the following context retrieved from the user's uploaded documents:\n\n${state.retrieved_context}\n\n---\n\nOriginal request: ${state.original_prompt}`

  const replacement = new HumanMessage({
    content: augmentedContent,
    id: lastHuman.id
  })

  return { messages: [replacement] }
}
