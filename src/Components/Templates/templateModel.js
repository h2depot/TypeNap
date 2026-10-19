export const SHARED_SCOPES = ['character', 'entity', 'world'];
export const FIELD_TYPES = ['String', 'StringList', 'Number', 'Boolean', 'Select'];
export const EDITABLE_FIELD_TYPES = ['String', 'StringList'];
export const newDefinition = (scope = 'character') => ({
    id: crypto.randomUUID(), name: '', scope, revision: 1, fields: [], createdAt: 0, updatedAt: 0,
});
export const newField = () => ({ id: crypto.randomUUID(), label: '', type: 'String', options: [] });
export const makeEntry = definition => ({ definition: structuredClone(definition), values: {}, ...(definition.scope !== 'private' ? { sourceDefinition: structuredClone(definition) } : {}) });
// Track the shared baseline separately from document-only edits, including legacy
// documents whose local revision may already collide with a library revision.
const definitionKey = definition => JSON.stringify([definition.id, definition.scope, definition.name, definition.revision,
    definition.fields.map(field => [field.id, field.label, field.type, field.options])]);
export const hasTemplateUpdate = (entry, latest) => Boolean(latest && definitionKey(entry.sourceDefinition ?? entry.definition) !== definitionKey(latest));
export function editEntry(entry, definition) {
    const next = updateEntry(entry, { ...definition, revision: entry.definition.revision, updatedAt: Date.now() });
    if (definition.scope !== 'private') next.sourceDefinition = structuredClone(entry.sourceDefinition ?? entry.definition);
    return next;
}
export const moveEntry = (stack, index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= stack.length) return stack;
    const next = [...stack];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
};
export function valueMatches(field, value) {
    if (value === null || value === undefined) return true;
    switch (field.type) {
        case 'String': return typeof value === 'string';
        case 'StringList': return Array.isArray(value) && value.every(item => typeof item === 'string');
        case 'Number': return typeof value === 'number' && Number.isFinite(value);
        case 'Boolean': return typeof value === 'boolean';
        case 'Select': return typeof value === 'string' && (value === '' || field.options.includes(value));
        default: return false;
    }
}
export function validStack(stack) {
    if (!Array.isArray(stack) || stack.length > 100) return false;
    const ids = new Set();
    return stack.every(entry => {
        const definition = entry?.definition;
        if (!definition || typeof definition.id !== 'string' || ids.has(definition.id)
            || typeof definition.name !== 'string' || !definition.name.trim() || !Number.isInteger(definition.revision) || definition.revision < 1
            || !['private', ...SHARED_SCOPES].includes(definition.scope) || !Array.isArray(definition.fields)
            || definition.fields.length > 200
            || !entry.values || typeof entry.values !== 'object' || Array.isArray(entry.values)) return false;
        ids.add(definition.id);
        const fieldIds = new Set();
        return definition.fields.every(field => {
            if (!field || typeof field.id !== 'string' || fieldIds.has(field.id) || typeof field.label !== 'string' || !field.label.trim()
                || !FIELD_TYPES.includes(field.type) || !Array.isArray(field.options) || !field.options.every(option => typeof option === 'string')
                || (field.type === 'Select' && (!field.options.length || field.options.some(option => !option.trim()) || new Set(field.options).size !== field.options.length))) return false;
            fieldIds.add(field.id);
            return valueMatches(field, entry.values[field.id]);
        }) && Object.keys(entry.values).every(id => fieldIds.has(id));
    });
}
// Keep values removed by a deliberate definition update, allowing a later re-add to recover them.
export function updateEntry(entry, definition) {
    const all = { ...entry.retiredValues, ...entry.values };
    const values = {}, retiredValues = {};
    for (const [id, value] of Object.entries(all)) {
        const field = definition.fields.find(field => field.id === id);
        if (field && valueMatches(field, value)) values[id] = value;
        else retiredValues[id] = value;
    }
    return { ...makeEntry(definition), values, retiredValues };
}
