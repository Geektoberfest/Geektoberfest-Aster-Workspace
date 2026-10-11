import api from './api'

export default {
  getPages: () => api.get('/pages'),
  getPage: (id) => api.get(`/pages/${id}`),
  createPage: (data) => api.post('/pages', data),
  updatePage: (id, data) => api.put(`/pages/${id}`, data),
  deletePage: (id) => api.delete(`/pages/${id}`),
  toggleFavorite: (id) => api.patch(`/pages/${id}/favorite`),
  restorePage: (id) => api.patch(`/pages/${id}/restore`),
  duplicatePage: (id) => api.post(`/pages/${id}/duplicate`),
  movePage: (id, parentPage, index) => api.patch(`/pages/${id}/move`, { parentPage, index }),
  permanentDelete: (id) => api.delete(`/pages/${id}/permanent`),
  getTrash: () => api.get('/pages/trash'),
  emptyTrash: () => api.delete('/pages/trash'),
  searchPages: (q) => api.get('/pages/search', { params: { q } }),
}