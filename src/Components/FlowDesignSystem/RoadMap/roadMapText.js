const normalizedName = value => value.trim().normalize('NFKC').toLocaleLowerCase()

export function roadMapTextNameError(stories, name, exceptId) {
  if (typeof name !== 'string' || !name.trim()) return 'required'
  if (name.trim().length > 100) return 'tooLong'
  if (stories.some(story => story.id !== exceptId && normalizedName(story.data.name) === normalizedName(name))) return 'duplicate'
  return null
}

export function roadMapTextRows(stories, query = '') {
  const search = query.trim().normalize('NFKC').toLocaleLowerCase()
  return stories.map((story, index) => ({ story, index }))
    .filter(({ story }) => !search || [story.data.name, story.data.content]
      .some(value => typeof value === 'string' && value.normalize('NFKC').toLocaleLowerCase().includes(search)))
}
