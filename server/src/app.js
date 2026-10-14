import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/authRoutes.js'
import pageRoutes from './routes/pageRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

const app = express()

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
app.use(cors({ origin: clientUrls, credentials: true }))

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }))
app.use('/api/auth', authRoutes)
app.use('/api/pages', pageRoutes)
app.use('/api/uploads', uploadRoutes)

app.use(notFound)
app.use(errorHandler)

export default app