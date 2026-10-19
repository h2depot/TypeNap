import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { GoBack, Plus, Trash2 } from '../../assets/IconList';
import { photoSource } from '../../assets/photoImages.js';
import { MAX_OBJECT_IMAGES, photoPaths, validImagePaths } from '../../utils/imagePaths.js';
import { useImageStore } from '../../store/imageStore';
import { TN_Button, TN_Dialog, TN_IconButton } from '../TNDesignSystem';
import styles from './ObjectImagesDialog.module.css';
import ImageCollectionPicker from './ImageCollectionPicker';

// Mounted for one open dialog so a cancelled draft never leaks into another object.
export default function ObjectImagesDialog({ name, imagePaths, onApply, onClose }) {
    const { t } = useTranslation();
    const [draftPaths, setPaths] = useState(() => photoPaths(imagePaths));
    const paths = photoPaths(draftPaths);
    const [choosing, setChoosing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const operation = useRef(false);
    const mounted = useRef(true);
    const firstAction = useRef(null);
    const wholeImageList = useImageStore(state => state.wholeImageList);
    const fetchImageList = useImageStore(state => state.fetchImageList);
    const addUserImage = useImageStore(state => state.addUserImage);
    const full = paths.length >= MAX_OBJECT_IMAGES;

    useEffect(() => {
        mounted.current = true;
        const previousFocus = document.activeElement;
        firstAction.current?.focus();
        fetchImageList().catch(error => {
            if (mounted.current) setError(String(error));
        }).finally(() => { if (mounted.current) setLoading(false); });
        return () => { mounted.current = false; previousFocus?.focus(); };
    }, [fetchImageList]);

    useEffect(() => {
        firstAction.current?.focus();
    }, [choosing]);

    const back = () => { if (!operation.current) setChoosing(false); };
    const close = () => { if (!operation.current) onClose(); };
    const addPath = path => {
        if (operation.current) return;
        setError('');
        setPaths(current => {
            if (current.includes(path)) return current.filter(selected => selected !== path);
            if (current.length >= MAX_OBJECT_IMAGES) return current;
            return photoPaths([...current, path]);
        });
    };
    const importImage = async () => {
        if (operation.current || full) return;
        operation.current = true; setBusy(true); setError('');
        try {
            const file = await open({ multiple: false, directory: false,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
            if (!file || !mounted.current) return;
            const image = await addUserImage(file);
            if (!mounted.current) return;
            setPaths(current => photoPaths([...current, image.path]));
            await fetchImageList();
        } catch (error) {
            if (mounted.current) setError(String(error));
        } finally {
            operation.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const apply = async () => {
        if (operation.current || !validImagePaths(paths)) return;
        operation.current = true; setBusy(true); setError('');
        try {
            await onApply(paths);
            if (mounted.current) onClose();
        } catch (error) {
            if (mounted.current) setError(String(error));
        } finally {
            operation.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    return createPortal(<div onKeyDown={event => {
        // Keep dialog shortcuts from reaching the editor behind it.
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); if (choosing) back(); else close(); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault(); void apply();
        }
        if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }}>
        <TN_Dialog isOpen onClose={choosing ? back : close}
            title={t(choosing ? 'objectImages.collection' : 'objectImages.title', { name })}
            maxWidth="680px">
            {choosing ? <div className={styles.selectionScreen} aria-busy={busy}>
                <div className={styles.collectionHeading}>
                    <span ref={firstAction} tabIndex={-1}><TN_IconButton icon={<GoBack size={20} />} variant="secondary"
                        onClick={back} aria-label={t('objectImages.back')}  /></span>
                    <span role="status" aria-live="polite">{paths.length} / {MAX_OBJECT_IMAGES}</span>
                </div>
                {loading ? <p>{t('common.loading')}</p> : <ImageCollectionPicker dimSelected showImport={false}
                    label={t('objectImages.collection')}
                    images={wholeImageList.filter(image => image.kind === 'user')}
                    isSelected={image => paths.includes(image.path)}
                    isImageDisabled={image => full && !paths.includes(image.path)}
                    disabled={busy} onSelect={addPath} />}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                    <TN_Button variant="proceed" disabled={busy} onClick={apply}>{t(busy ? 'jsonBox.saving' : 'editor.save')}</TN_Button>
                </div>
            </div> :
            <div className={styles.content} aria-busy={busy}>
                <div className={styles.photoHeading}>
                    <p className={styles.description}>{t('objectImages.limit', { max: MAX_OBJECT_IMAGES })}</p>
                    <span className={styles.count} role="status" aria-live="polite">{paths.length} / {MAX_OBJECT_IMAGES}</span>
                </div>
                <div className={styles.registered}>
                    {Array.from({ length: MAX_OBJECT_IMAGES }, (_, index) => {
                        const path = paths[index];
                        return <div key={index} className={styles.slot} data-filled={Boolean(path) || undefined}>
                            {path ? <>
                                <img src={photoSource(path)} alt={t('objectImages.photo', { index: index + 1 })} />
                                <TN_IconButton icon={<Trash2 size={18} />} size="small" variant="secondary"
                                    aria-label={t('objectImages.remove', { index: index + 1 })} disabled={busy}
                                    onClick={() => setPaths(current => current.filter((_, i) => i !== index))} />
                            </> : <span className={styles.empty}><Plus size={24} aria-hidden="true" />{t('objectImages.emptySlot', { index: index + 1 })}</span>}
                        </div>;
                    })}
                </div>
                <div className={styles.addActions} ref={firstAction} tabIndex={-1}>
                    <TN_Button variant="secondary" disabled={busy || full} onClick={importImage}>
                        <Plus size={18} />{t('objectImages.import')}
                    </TN_Button>
                    <TN_Button variant="secondary" disabled={busy || full} onClick={() => setChoosing(true)}>
                        {t('objectImages.collection')}
                    </TN_Button>
                </div>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                    <TN_Button variant="secondary" disabled={busy} onClick={close}>{t('common.cancel')}</TN_Button>
                    <TN_Button variant="proceed" disabled={busy} onClick={apply}>{t(busy ? 'jsonBox.saving' : 'editor.save')}</TN_Button>
                </div>
            </div>}
        </TN_Dialog>
    </div>, document.body);
}
