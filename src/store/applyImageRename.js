import { useAppSettings } from './saving/appSettings';
import { useFileStore } from './fileStore';
import { useStoryStore } from './storyStore';
import { useTxtStore } from './txtStore';
import { normalizeImageContent, normalizeImagePath, registerImageRenames } from '../utils/imagePaths.js';

export function applyImageRename(result) {
    registerImageRenames(result.redirects);
    const replace = path => normalizeImagePath(path) === normalizeImagePath(result.old_path) ? result.new_path : normalizeImagePath(path);
    useAppSettings.setState(state => ({ settings: { ...state.settings, bgimage: state.settings.bgimage?.path
        ? { ...state.settings.bgimage, path: replace(state.settings.bgimage.path) } : state.settings.bgimage } }));
    useFileStore.setState(state => ({ storyList: state.storyList.map(story => ({ ...story, cover: replace(story.cover) })) }));
    useStoryStore.setState(state => ({ workspaces: Object.fromEntries(Object.entries(state.workspaces).map(([id, workspace]) => [id, { ...workspace, cover: replace(workspace.cover) }])) }));
    useTxtStore.setState(state => ({ workspaces: Object.fromEntries(Object.entries(state.workspaces).map(([id, workspace]) => {
        if (!workspace.contentsInfo?.content_type || workspace.contentsInfo.content_type === 'txt') return [id, workspace];
        const content = normalizeImageContent(workspace.content);
        return [id, content === workspace.content ? workspace : { ...workspace, content,
            savedContentLength: workspace.isEdited ? workspace.savedContentLength : content.length }];
    })) }));
}
