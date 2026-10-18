/** Frontend model of Rust file_ops::contents_info::ContentsInfo.
 * @typedef {{story_name: string, name: string, access_id: string,
 * content_type: 'txt'|'character'|'world'|'entity'}} ContentsInfo
 */
export const CONTENT_TYPES = ['txt', 'character', 'world', 'entity'];

export function contentsInfo(value) {
    if (!value || typeof value.story_name !== 'string' || typeof value.name !== 'string'
        || typeof value.access_id !== 'string' || !value.access_id
        || !CONTENT_TYPES.includes(value.content_type)) throw new Error('Invalid ContentsInfo');
    return { story_name: value.story_name, name: value.name,
        access_id: value.access_id.toLowerCase(), content_type: value.content_type };
}

// UUID is stable across content and story renames. Names are display metadata.
export const contentId = value => value?.access_id?.toLowerCase();
export const sameContent = (a, b) => Boolean(contentId(a) && contentId(a) === contentId(b));
export const contentTabProps = value => {
    const info = contentsInfo(value);
    return { ...info, title: info.name, workspaceID: info.access_id };
};
