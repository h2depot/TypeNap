export function validProperties(properties) {
  return properties !== null && typeof properties === 'object' && !Array.isArray(properties)
    && Object.values(properties).every(value => typeof value === 'string'
      || (Array.isArray(value) && value.every(item => typeof item === 'string')))
}