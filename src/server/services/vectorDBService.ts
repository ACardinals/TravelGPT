import { ChromaClient, type Collection, type Where, IncludeEnum } from 'chromadb';
import { getTextEmbeddings, EMBEDDING_DIMENSION } from './embeddingService';

let client: ChromaClient;
let collection: Collection | null = null;

const COLLECTION_NAME = 'travel_knowledge_base';

// Function to initialize ChromaDB client
function initializeChromaClient(): ChromaClient {
  if (!client) {
    // For local development, ChromaClient defaults to http://localhost:8000
    // Ensure you have ChromaDB running, or use a specific path for an in-memory/persistent local DB.
    // e.g., client = new ChromaClient({ path: "path/to/data" }); for persistence
    // For now, let's assume a running ChromaDB server or it will use a default in-memory option if not configured for persistence.
    client = new ChromaClient(); 
    console.log('ChromaDB client initialized.');
  }
  return client;
}

/**
 * Gets an existing collection or creates a new one if it doesn't exist.
 * @returns The ChromaDB collection.
 */
export async function getOrCreateCollection(): Promise<Collection> {
  initializeChromaClient();
  if (!collection) {
    try {
      console.log(`Attempting to get or create collection: ${COLLECTION_NAME}`);
      collection = await client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' }, // Specify cosine distance for similarity
        // embeddingFunction: // ChromaDB can have its own embedding function, but we are providing embeddings directly
      });
      console.log(`Collection '${COLLECTION_NAME}' ready.`);
    } catch (error) {
      console.error(`Failed to get or create collection '${COLLECTION_NAME}':`, error);
      throw new Error('Failed to initialize ChromaDB collection.');
    }
  }
  return collection;
}

/**
 * Adds documents with their embeddings to the collection.
 * @param documents An array of text documents to add.
 * @param ids An array of unique IDs for each document. Must be the same length as documents.
 * @param metadatas Optional array of metadata objects for each document.
 * @returns A promise that resolves when documents are added.
 */
export async function addDocumentsToCollection(
  documents: string[],
  ids: string[],
  metadatas?: Record<string, any>[]
): Promise<void> {
  if (documents.length === 0) {
    console.log('No documents to add.');
    return;
  }
  if (documents.length !== ids.length) {
    throw new Error('Documents and IDs arrays must have the same length.');
  }
  if (metadatas && metadatas.length !== documents.length) {
    throw new Error('Metadatas array must have the same length as documents if provided.');
  }

  const targetCollection = await getOrCreateCollection();
  console.log(`Generating embeddings for ${documents.length} documents...`);
  const embeddings = await getTextEmbeddings(documents);

  if (embeddings.length !== documents.length) {
    throw new Error('Mismatch between number of documents and generated embeddings.');
  }
  
  // Ensure all embeddings have the correct dimension
  for (const emb of embeddings) {
    if (emb.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${emb.length}`);
    }
  }

  console.log(`Adding ${documents.length} documents to collection '${COLLECTION_NAME}'...`);
  try {
    await targetCollection.add({
      ids: ids,
      embeddings: embeddings,
      metadatas: metadatas, // ChromaDB expects 'metadatas'
      documents: documents, // ChromaDB expects 'documents'
    });
    console.log(`${documents.length} documents added successfully.`);
  } catch (error) {
    console.error('Failed to add documents to collection:', error);
    throw error; // Re-throw the error after logging
  }
}

/**
 * Queries the collection for documents similar to the query text.
 * @param queryText The text to search for.
 * @param nResults The number of results to return.
 * @param where Optional filter to apply to the query.
 * @param include Optional array of fields to include in the results.
 * @returns A promise that resolves with the query results.
 */
export async function queryCollection(
  queryText: string,
  nResults: number = 5,
  where?: Where,
  include?: IncludeEnum[]
): Promise<any> { // Consider defining a more specific return type based on ChromaDB's QueryResponse
  const targetCollection = await getOrCreateCollection();
  // console.log(`Generating embedding for query: "${queryText}"`);
  const queryEmbedding = (await getTextEmbeddings(queryText))[0];

  if (!queryEmbedding || queryEmbedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Failed to generate valid query embedding or dimension mismatch. Expected ${EMBEDDING_DIMENSION}`);
  }

  // console.log(`Querying collection '${COLLECTION_NAME}' with ${nResults} results...`);
  try {
    const results = await targetCollection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: nResults,
      where: where, // e.g., { source: "official-docs" }
      include: include ?? [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances], // Default includes using IncludeEnum
    });
    // console.log('Query successful.');
    return results;
  } catch (error) {
    console.error('Failed to query collection:', error);
    throw error; // Re-throw the error after logging
  }
}

// --- Example Usage (for testing, can be commented out or moved) ---
async function runVectorDBTests() {
  console.log('Running VectorDB Service Tests...');
  try {
    // 1. Get or create collection
    const collectionInstance = await getOrCreateCollection();
    console.log('Test: Collection obtained:', collectionInstance.name);

    // 2. Add some dummy documents (clear existing first for consistent testing if needed)
    // For a clean test, you might want to delete and recreate the collection or clear it.
    // await client.deleteCollection({ name: COLLECTION_NAME });
    // console.log('Test: Old collection deleted for clean test.');
    // await getOrCreateCollection(); // Recreate
    // Alternatively, if Chroma supports it, clear items by IDs if they exist.

    const dummyDocs = [
      "Paris is the capital of France and known for the Eiffel Tower.",
      "London is the capital of the United Kingdom and has the Big Ben.",
      "Berlin is the capital of Germany, famous for the Brandenburg Gate.",
      "The Louvre Museum in Paris houses the Mona Lisa.",
      "To travel to Paris, you might need a Schengen visa.",
      "What are some famous landmarks in Paris, France?"
    ];
    const dummyIds = ["doc1", "doc2", "doc3", "doc4", "doc5", "doc6"];
    const dummyMetadatas = [
      { source: "wiki-paris", type: "city-info" },
      { source: "wiki-london", type: "city-info" },
      { source: "wiki-berlin", type: "city-info" },
      { source: "museum-db", type: "art-info" },
      { source: "travel-guide", type: "travel-tip" },
      { source: "query-example", type: "question" }
    ];

    // Check if documents already exist to avoid duplicate ID errors
    // This is a simplified check. A more robust way would be to query by IDs first.
    let existingDocs: string[] = [];
    try {
      const existing = await collectionInstance.get({ ids: dummyIds, include: [IncludeEnum.Documents] });
      existingDocs = existing.ids;
    } catch(e) {
        // Collection might be empty or get might fail for other reasons, proceed cautiously
        console.warn("Could not accurately determine existing documents, may encounter ID conflicts.")
    }

    const docsToAdd = [];
    const idsToAdd = [];
    const metadatasToAdd = [];

    for(let i=0; i < dummyDocs.length; i++) {
        if(!existingDocs.includes(dummyIds[i])) {
            docsToAdd.push(dummyDocs[i]);
            idsToAdd.push(dummyIds[i]);
            metadatasToAdd.push(dummyMetadatas[i]);
        }
    }

    if (docsToAdd.length > 0) {
        console.log(`Test: Adding ${docsToAdd.length} new dummy documents...`);
        await addDocumentsToCollection(docsToAdd, idsToAdd, metadatasToAdd);
        console.log('Test: Dummy documents added.');
    } else {
        console.log('Test: All dummy documents already exist in the collection.');
    }


    // 3. Query the collection
    const query = "What is Paris known for?";
    console.log(`Test: Querying for: "${query}"`);
    const results = await queryCollection(query, 3);

    console.log('Test: Query results:');
    if (results.ids && results.ids.length > 0) {
      for (let i = 0; i < results.ids[0].length; i++) {
        console.log({
          id: results.ids[0][i],
          document: results.documents ? results.documents[0][i] : 'N/A',
          distance: results.distances ? results.distances[0][i] : 'N/A',
          metadata: results.metadatas ? results.metadatas[0][i] : 'N/A',
        });
      }
    } else {
      console.log('No results found or unexpected result format.');
    }

  } catch (error) {
    console.error('Error during VectorDB service tests:', error);
  } finally {
    // Optional: Clean up or reset client/collection if necessary for subsequent tests or app runs
    // e.g., if using an in-memory DB that doesn't persist across script runs, this might not be needed.
    // If it's a persistent DB, you might want to clear test data.
    console.log('VectorDB Service Tests finished.');
  }
}

// To run the tests when this file is executed directly (e.g., `node vectorDBService.js` if compiled or via ts-node)
// if (require.main === module) { // This check doesn't work directly with ES modules and ts-node typical setups
//   runVectorDBTests();
// }
// Instead, you can explicitly call it if needed for standalone testing:
// runVectorDBTests();

export { runVectorDBTests }; // Export the test function 