import { useCallback, useEffect, useId, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Save } from '../../../assets/IconList';
import { useStoryStore } from '../../../store/storyStore';
import { useAppSettings } from '../../../store/saving/appSettings';
import { PlainStarterKit, PlainParagraph, PlainTextClipboard, textToDocument, documentToText } from '../../TextBox/plainTextEditor';
import styles from './SynopsisEditor.module.css';

export default function SynopsisEditor({ storyName }) {
    const { t } = useTranslation();
    const id = useId();
    const workspace = useStoryStore(state => state.workspaces[storyName]);
    const updateSynopsis = useStoryStore(state => state.updateSynopsis);
    const saveSynopsis = useStoryStore(state => state.saveSynopsis);
    const fontSize = useAppSettings(state => state.settings.fontSize);
    const [isComposing, setIsComposing] = useState(false);
    const content = workspace?.synopsisDraft ?? workspace?.synopsis ?? '';
    const save = useCallback(() => {
        void saveSynopsis(storyName).catch(error => console.error('Synopsis save failed', error));
    }, [saveSynopsis, storyName]);
    const editor = useEditor({
        extensions: [PlainStarterKit, PlainParagraph, PlainTextClipboard],
        content: textToDocument(content),
        enableInputRules: false,
        enablePasteRules: false,
        editorProps: {
            attributes: {
                id, class: styles.input, role: 'textbox', 'aria-multiline': 'true',
                'aria-label': t('story.summary.synopsis'), spellcheck: 'false',
            },
            handleDOMEvents: {
                compositionstart: () => { setIsComposing(true); return false; },
                compositionend: () => { setIsComposing(false); return false; },
            },
        },
        onUpdate: ({ editor }) => updateSynopsis(storyName, documentToText(editor.state.doc)),
    }, [storyName]);

    useEffect(() => {
        if (!editor || editor.view.composing) return;
        if (documentToText(editor.state.doc) !== content.replace(/\r\n?/g, '\n')) {
            editor.commands.setContent(textToDocument(content), { emitUpdate: false });
        }
    }, [editor, content, isComposing]);

    useEffect(() => {
        const handleSave = event => { if (event.detail?.storyName === storyName) save(); };
        window.addEventListener('save-story-synopsis', handleSave);
        return () => window.removeEventListener('save-story-synopsis', handleSave);
    }, [storyName, save]);

    const status = workspace?.synopsisSaveError ? 'story.summary.saveFailed'
        : workspace?.synopsisIsSaving ? 'story.summary.saving'
            : workspace?.synopsisIsEdited ? 'editor.unsaved' : 'editor.saved';
    return <div className={styles.container}>
        <div className={styles.toolbar}>
            <label htmlFor={id}>{t('story.summary.synopsis')}</label>
            <div className={styles.actions}>
                <span className={styles.count}>{t('common.characterCount', { count: content.length })}</span>
                <button type="button" className={styles.save} onClick={save}
                    disabled={workspace?.synopsisIsSaving || !workspace?.synopsisIsEdited}
                    data-error={Boolean(workspace?.synopsisSaveError)}>
                    <Save size={14} aria-hidden="true" /><span role="status" aria-live="polite">{t(status)}</span>
                </button>
            </div>
        </div>
        <div className={styles.editorShell} style={{ fontSize: `${fontSize ?? 16}px` }}>
            <EditorContent editor={editor} className={styles.editorContent} />
            {editor?.isEmpty && <div className={styles.placeholder} aria-hidden="true">{t('story.summary.synopsisPlaceholder')}</div>}
        </div>
    </div>;
}
