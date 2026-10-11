const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schemas = {
  register: {
    name: { label: 'Name', required: true, type: 'string', maxLength: 60 },
    email: { label: 'Email', required: true, type: 'string', maxLength: 254, pattern: EMAIL_REGEX },
    password: { label: 'Password', required: true, type: 'string', minLength: 8, maxLength: 128 },
  },
  login: {
    email: { label: 'Email', required: true, type: 'string', maxLength: 254, pattern: EMAIL_REGEX },
    password: { label: 'Password', required: true, type: 'string', maxLength: 128 },
  },
  createPage: {
    title: { label: 'Title', type: 'string', maxLength: 300 },
    icon: { label: 'Icon', type: 'string', maxLength: 16 },
    content: { label: 'Content', type: 'tiptapDoc' },
    parentPage: { label: 'Parent page', type: 'string', maxLength: 64 },
  },
  updatePage: {
    title: { label: 'Title', type: 'string', maxLength: 300 },
    icon: { label: 'Icon', type: 'string', maxLength: 16 },
    content: { label: 'Content', type: 'tiptapDoc' },
  },
  movePage: {
    parentPage: { label: 'Parent page', type: 'string', maxLength: 64 },
  },
}

const validate = (schemaName) => (req, res, next) => {
  const schema = schemas[schemaName]
  const errors = []

  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body?.[field]
    const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

    if (isEmpty) {
      if (rules.required) errors.push(`${rules.label} is required`)
      continue
    }

    if (rules.type === 'tiptapDoc') {
      if (typeof value !== 'object' || Array.isArray(value) || value.type !== 'doc') {
        errors.push('Content must be a valid document')
      }
      continue
    }

    if (typeof value !== 'string') {
      errors.push(`${rules.label} must be a string`)
      continue
    }
    if (rules.minLength && value.length < rules.minLength)
      errors.push(`${rules.label} must be at least ${rules.minLength} characters`)
    if (rules.maxLength && value.length > rules.maxLength)
      errors.push(`${rules.label} must be at most ${rules.maxLength} characters`)
    if (rules.pattern && !rules.pattern.test(value)) errors.push(`${rules.label} is invalid`)
  }

  if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') })
  next()
}

export default validate