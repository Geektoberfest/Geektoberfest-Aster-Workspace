import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, inject } from 'vitest'

// Each test file gets its own database on the shared in-memory server, which is wiped
// after every test, so tests are independent and can be repeated without leftover state.
beforeAll(async () => {
  const baseUri = inject('mongoUri').replace(/\/$/, '')
  const dbName = `aster_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  await mongoose.connect(`${baseUri}/${dbName}`)
})

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
