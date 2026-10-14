import { Router } from 'express'
import protect from '../middleware/auth.js'
import { getImage, receiveImage, uploadImage } from '../controllers/uploadController.js'

const router = Router()
router.use(protect)

router.post('/', receiveImage, uploadImage)
router.get('/:id', getImage)

export default router
