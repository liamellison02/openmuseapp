import { MongoClient } from 'mongodb';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';

const client = new MongoClient(process.env.MONGODB_URI || '');
const namespace = 'your_database_name.your_collection_name'; // Replace with your DB and Collection
const [dbName, collectionName] = namespace.split('.');
const collection = client.db(dbName).collection(collectionName);

// Ensure environment variables are loaded
if (!process.env.OPENAI_API_KEY || !process.env.MONGODB_URI) {
  throw new Error('Missing required environment variables: OPENAI_API_KEY and MONGODB_URI');
}

const vectorStore = new MongoDBAtlasVectorSearch(
  new OpenAIEmbeddings({
    // Optional: specify model if needed, defaults usually fine
    // modelName: 'text-embedding-ada-002',
  }),
  {
    collection: collection,
    indexName: 'your_vector_index_name', // Replace with your Atlas Vector Search index name
    textKey: 'text', // Key holding the text content in your documents
    embeddingKey: 'embedding', // Key holding the vector embeddings in your documents
  }
);

/**
 * Retrieves relevant context from MongoDB Atlas Vector Search based on the user query.
 *
 * @param query The user's query string.
 * @param k The number of documents to retrieve (default: 4).
 * @returns A promise that resolves to the formatted context string.
 */
export async function retrieveContext(query: string, k: number = 4): Promise<string> {
  console.log(`Retrieving context for query: "${query}" from MongoDB`);
  try {
    // Perform the similarity search
    const results = await vectorStore.similaritySearch(query, k);

    // Format the results into a single context string
    const formattedContext = results
      .map((doc) => doc.pageContent) // pageContent usually holds the 'textKey' value
      .join('\n\n---\n\n'); // Separate documents clearly

    console.log(`Retrieved context: ${results.length} documents found.`);
    return formattedContext;
  } catch (error) {
    console.error('Error retrieving context from MongoDB:', error);
    // Return an empty string or a default message in case of error
    return 'Error retrieving context. Please check the logs.';
  } finally {
    // Optional: Close the client if your application lifecycle requires it.
    // For serverless functions, establishing the connection per request might be necessary,
    // but keeping it open might be better for long-running servers.
    // await client.close(); // Consider connection pooling or management strategies
  }
}
