import { MongoMemoryServer } from 'mongodb-memory-server'

// Starts a single throwaway in-memory MongoDB for the whole run. It never touches
// MONGO_URI or any real database, and is shut down (and its data discarded) afterwards.
export default async function setup(project) {
  const mongod = await MongoMemoryServer.create()
  project.provide('mongoUri', mongod.getUri())
  return async () => {
    await mongod.stop()
  }
}
