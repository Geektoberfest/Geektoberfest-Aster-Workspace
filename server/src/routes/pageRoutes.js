import { Router } from 'express'
import protect from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import {
  getPages, getTrash, getPage, createPage, updatePage, toggleFavorite,
  deletePage, restorePage, duplicatePage, permanentDelete, emptyTrash, searchPages,
} from '../controllers/pageController.js'
import { listVersions, getVersion, restoreVersion } from '../controllers/versionController.js'

const router = Router()
router.use(protect)

router.get('/', getPages)
router.get('/search', searchPages)
router.get('/trash', getTrash)
router.delete('/trash', emptyTrash)
router.get('/:id', getPage)
router.post('/', validate('createPage'), createPage)
router.put('/:id', validate('updatePage'), updatePage)
router.patch('/:id/favorite', toggleFavorite)
router.patch('/:id/restore', restorePage)
router.post('/:id/duplicate', duplicatePage)
router.get('/:id/versions', listVersions)
router.get('/:id/versions/:versionId', getVersion)
router.post('/:id/versions/:versionId/restore', restoreVersion)
router.delete('/:id', deletePage)
router.delete('/:id/permanent', permanentDelete)

export default router