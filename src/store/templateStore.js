import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

let pending;
let mutationVersion = 0;
export const useTemplateStore = create((set, get) => ({
    templates: [], loading: false, error: '',
    refresh: () => {
        if (pending) return pending;
        set({ loading: true, error: '' });
        const version = mutationVersion;
        pending = invoke('list_templates').then(templates => { if (version === mutationVersion) set({ templates }); return get().templates; })
            .catch(error => { set({ error: String(error) }); throw error; })
            .finally(() => { pending = null; set({ loading: false }); });
        return pending;
    },
    save: async definition => {
        const saved = await invoke('save_template', { definition });
        mutationVersion++;
        set({ templates: [...get().templates.filter(item => item.id !== saved.id), saved] });
        return saved;
    },
    remove: async id => {
        await invoke('delete_template', { id });
        mutationVersion++;
        set({ templates: get().templates.filter(item => item.id !== id) });
    },
    backups: () => invoke('list_template_backups'),
    restore: async (definition, expectedRevision) => {
        const saved = await invoke('restore_template_backup', { id: definition.id, revision: definition.revision, expectedRevision });
        mutationVersion++;
        set({ templates: [...get().templates.filter(item => item.id !== saved.id), saved] });
        return saved;
    },
}));
