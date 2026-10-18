import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, Images, PageSearch, Plus, Trash2, X } from '../../../assets/IconList';
import { photoSource } from '../../../assets/photoImages.js';
import { useImageStore } from '../../../store/imageStore';
import { useAppSettings } from '../../../store/saving/appSettings';
import { normalizeImagePath } from '../../../utils/imagePaths.js';
import { TN_Button, TN_Dropdown, TN_IconButton, TN_TextField } from '../../TNDesignSystem';
import { IMAGE_GAP, IMAGE_META_HEIGHT, layoutImages, selectImages } from './imageGallery.js';
import { ImageDeleteDialog, ImagePreview, ImageRenameDialog } from './ImageDialogs.jsx';
import styles from './ImageView.module.css';

// Module-level cache: persists across mounts (tab switches) within the same session.
// galleryWidth avoids the null→measured-width layout recalculation on re-entry.
// dimensions avoids re-measuring every image's natural size on re-entry.
let _cachedWidth = null;
let _cachedDimensions = {};

export default function ImageView() {
    const { t, i18n } = useTranslation();
    const wholeImageList = useImageStore(state => state.wholeImageList);
    const fetchImageList = useImageStore(state => state.fetchImageList);
    const addUserImage = useImageStore(state => state.addUserImage);
    const deleteUserImage = useImageStore(state => state.deleteUserImage);
    const renameUserImage = useImageStore(state => state.renameUserImage);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [ascending, setAscending] = useState(true);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [listError, setListError] = useState('');
    const [importError, setImportError] = useState('');
    const [dimensions, setDimensions] = useState(_cachedDimensions);
    const [galleryWidth, setGalleryWidth] = useState(_cachedWidth);
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedPaths, setSelectedPaths] = useState(() => new Set());
    const [deleteTargets, setDeleteTargets] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [renameTarget, setRenameTarget] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState('');
    const gallery = useRef(null);
    const mounted = useRef(true);
    const operation = useRef(false);
    const loadRequest = useRef(0);

    const loadImages = useCallback(async () => {
        const request = ++loadRequest.current;
        setLoading(true);
        setListError('');
        try {
            await fetchImageList();
        } catch (error) {
            if (mounted.current && request === loadRequest.current) setListError(String(error));
        } finally {
            if (mounted.current && request === loadRequest.current) setLoading(false);
        }
    }, [fetchImageList]);

    useEffect(() => {
        mounted.current = true;
        void loadImages();
        return () => { mounted.current = false; };
    }, [loadImages]);

    useEffect(() => {
        const available = new Set(wholeImageList.filter(image => image.kind === 'user').map(image => image.path));
        setSelectedPaths(current => {
            const next = new Set([...current].map(normalizeImagePath).filter(path => available.has(path)));
            return next.size === current.size && [...next].every(path => current.has(path)) ? current : next;
        });
    }, [wholeImageList]);

    // Observe the FixedView's usable width, including changes caused by its scrollbar.
    // We use useLayoutEffect so the measurement runs synchronously after DOM paint,
    // avoiding the null→real-width flicker that would occur with useEffect.
    useLayoutEffect(() => {
        const element = gallery.current;
        const measure = () => {
            const w = element.getBoundingClientRect().width;
            // Persist to module cache so re-mounts start with the correct width immediately.
            if (_cachedWidth !== w) _cachedWidth = w;
            // Only update state when the value actually changes to avoid extra renders.
            setGalleryWidth(prev => (prev === w ? prev : w));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const visibleImages = useMemo(() => selectImages(wholeImageList, {
        query, sortBy, ascending, locale: i18n.language,
    }), [wholeImageList, query, sortBy, ascending, i18n.language]);
    // Defer layout until the gallery width is known (null = not yet measured).
    const layout = useMemo(
        () => galleryWidth !== null ? layoutImages(visibleImages, dimensions, galleryWidth) : { items: [], height: 0 },
        [visibleImages, dimensions, galleryWidth]
    );
    const filtered = Boolean(query);
    const resetFilters = () => setQuery('');
    const selectedImages = wholeImageList.filter(image => image.kind === 'user' && selectedPaths.has(image.path));
    const selectionMode = selectedImages.length > 0;
    const busy = importing || deleting || renaming;
    const requestRename = image => {
        if (operation.current || deleteTargets.length || image.kind !== 'user') return;
        setRenameError(''); setRenameTarget(image);
    };
    const closeRename = () => { if (!operation.current) { setRenameTarget(null); setRenameError(''); } };
    const confirmRename = async newName => {
        if (operation.current || !renameTarget) return;
        operation.current = true; setRenaming(true); setRenameError('');
        try {
            const result = await renameUserImage(renameTarget, newName);
            if (!mounted.current) return;
            const name = result.new_path.split(/[\\/]/).at(-1);
            setPreviewImage(current => current && normalizeImagePath(current.path) === normalizeImagePath(result.old_path) ? { ...current, path: result.new_path, name } : current);
            setSelectedPaths(current => new Set([...current].map(normalizeImagePath)));
            setDimensions(current => {
                const previousPath = renameTarget.path;
                if (!current[previousPath] || previousPath === result.new_path) return current;
                const next = { ...current, [result.new_path]: current[previousPath] }; delete next[previousPath]; return next;
            });
            setRenameTarget(null);
        } catch (error) {
            if (mounted.current) setRenameError(String(error));
        } finally {
            operation.current = false; if (mounted.current) setRenaming(false);
        }
    };

    const toggleImage = image => {
        if (operation.current || image.kind !== 'user') return;
        setSelectedPaths(current => {
            const next = new Set(current);
            if (next.has(image.path)) next.delete(image.path);
            else next.add(image.path);
            return next;
        });
    };

    const requestDelete = images => {
        if (operation.current) return;
        const targets = images.filter(image => image.kind === 'user');
        if (!targets.length) return;
        setDeleteError('');
        setDeleteTargets(targets);
    };
    const closeDelete = () => { if (!operation.current) { setDeleteTargets([]); setDeleteError(''); } };

    const confirmDelete = async () => {
        if (operation.current || !deleteTargets.length) return;
        operation.current = true;
        setDeleting(true);
        setDeleteError('');
        const deletedPaths = new Set();
        const failures = [];
        try {
            for (const image of deleteTargets) {
                if (image.kind !== 'user') continue;
                try {
                    await deleteUserImage(image.name);
                    deletedPaths.add(image.path);
                } catch (error) {
                    failures.push({ image, error: String(error) });
                }
            }
            const settings = useAppSettings.getState();
            if (deletedPaths.has(normalizeImagePath(settings.settings.bgimage?.path))) {
                await settings.updateSetting('bgimage', {});
            }
            if (mounted.current) {
                setSelectedPaths(current => new Set([...current].filter(path => !deletedPaths.has(path))));
                setPreviewImage(current => current && deletedPaths.has(current.path) ? null : current);
                setDeleteTargets(failures.map(({ image }) => image));
                setDeleteError(failures.map(({ image, error }) => `${image.name}: ${error}`).join('\n'));
                await loadImages();
            }
        } finally {
            operation.current = false;
            if (mounted.current) setDeleting(false);
        }
    };

    const recordSize = (path, size) => setDimensions(current => {
        const previous = current[path];
        if (previous?.width === size.width && previous?.height === size.height && previous?.failed === size.failed) return current;
        const next = { ...current, [path]: size };
        // Persist to module cache so re-mounts can skip re-measuring already-loaded images.
        _cachedDimensions = next;
        return next;
    });

    const importImages = async () => {
        if (operation.current) return;
        operation.current = true;
        setImporting(true);
        setImportError('');
        let added = 0;
        try {
            const files = await open({ multiple: true, directory: false,
                filters: [{ name: t('navigation.images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
            if (!files || !mounted.current) return;
            for (const file of Array.isArray(files) ? files : [files]) {
                if (!mounted.current) break;
                await addUserImage(file);
                added++;
            }
        } catch (error) {
            if (mounted.current) setImportError(String(error));
        } finally {
            // Also refresh after a partial import, so successful files remain visible.
            if (added && mounted.current) await loadImages();
            operation.current = false;
            if (mounted.current) setImporting(false);
        }
    };

    return <div className={styles.container} onKeyDown={event => {
        if (event.key === 'Escape' && selectionMode && !deleteTargets.length && !previewImage && !renameTarget && !busy) {
            event.stopPropagation();
            setSelectedPaths(new Set());
        }
    }}>
        <div className={styles.controls}>
            <div className={styles.search}>
                <TN_TextField value={query} onChange={event => setQuery(event.target.value)}
                    placeholder={t('imageLibrary.searchPlaceholder')} aria-label={t('imageLibrary.searchPlaceholder')}
                    icon={<PageSearch size={18} />} borderRadius="10px" data-image-library-search />
            </div>
            <div className={styles.selectionSpace}>
                {selectionMode && <div className={styles.selectionToolbar} role="toolbar" aria-label={t('imageLibrary.selectionActions')}>
                    <div className={styles.selectionSummary}>
                        <button type="button" className={styles.selectionCancel} onClick={() => setSelectedPaths(new Set())} disabled={busy}
                            aria-label={t('imageLibrary.clearSelection')} title={t('imageLibrary.clearSelection')}>
                            <X size={16} aria-hidden="true" />
                        </button>
                        <span role="status">{t('imageLibrary.selectedCount', { count: selectedImages.length })}</span>
                    </div>
                    <TN_IconButton icon={<Trash2 size={18} />} size="small" onClick={() => requestDelete(selectedImages)} disabled={busy}
                        style={{ width: 32, height: 32, padding: 2 }}
                        aria-label={t('imageLibrary.deleteSelected')} title={t('imageLibrary.deleteSelected')} />
                </div>}
            </div>
            <div className={styles.rightControls}>
                <TN_Dropdown value={sortBy} onChange={setSortBy} width="180px" aria-label={t('library.sort.placeholder')}
                    options={[
                        { value: 'name', label: t('imageLibrary.sortName') },
                        { value: 'updated', label: t('library.sort.updated') },
                        { value: 'created', label: t('library.sort.created') },
                    ]} />
                <TN_IconButton icon={ascending ? <ArrowUpWideNarrow size={20} /> : <ArrowDownWideNarrow size={20} />}
                    onClick={() => setAscending(value => !value)} variant="secondary"
                    title={t(ascending ? 'library.sort.ascending' : 'library.sort.descending')}
                    aria-label={t(ascending ? 'library.sort.ascending' : 'library.sort.descending')} />
            </div>
        </div>
        <div className={styles.resultRow}>
            <div className={styles.resultCount} role="status">
                {loading ? t('common.loading') : query.trim() && t('imageLibrary.resultCount', { count: visibleImages.length, total: wholeImageList.length })}
            </div>
            <TN_Button variant="proceed" borderRadius="10px" disabled={busy} onClick={importImages}>
                <span className={styles.addLabel}><Plus size={18} />{t(importing ? 'imageLibrary.importing' : 'imageLibrary.import')}</span>
            </TN_Button>
        </div>
        {(listError || importError) && <div className={styles.error} role="alert">
            <p>{t(listError ? 'notice.imageListFailed' : 'notice.imageAddFailed')}</p>
            <p className={styles.errorDetail}>{listError || importError}</p>
            {listError && <TN_Button variant="secondary" onClick={loadImages} disabled={loading}>{t('imageLibrary.retry')}</TN_Button>}
        </div>}
        <div ref={gallery} className={`${styles.gallery} ${selectionMode ? styles.selectionMode : ''}`} role="list" aria-label={t('navigation.images')} aria-busy={loading || deleting}
            style={{ height: layout.height, '--image-meta-height': `${IMAGE_META_HEIGHT}px`, '--image-gap': `${IMAGE_GAP}px` }}>
            {layout.items.map(({ image, x, y, width, height, imageHeight }) => {
                const size = dimensions[image.path];
                const selected = selectedPaths.has(image.path);
                const selectable = image.kind === 'user';
                return <div key={image.path} role="listitem" className={`${styles.item} ${selected ? styles.selected : ''}`} style={{ width, height, left: x, top: y }}>
                    <button type="button" className={styles.card} disabled={busy}
                        onClick={() => selectionMode && selectable ? toggleImage(image) : setPreviewImage(image)}
                        aria-label={t(selectionMode && selectable ? (selected ? 'imageLibrary.deselectImage' : 'imageLibrary.selectImage') : 'imageLibrary.openPreview', { name: image.name })}>
                        <div className={styles.thumbnail} style={{ height: imageHeight }}>
                            {size?.failed ? <div className={styles.imageFallback}>
                                <Images size={28} aria-hidden="true" /><span>{t('imageLibrary.imageFailed')}</span>
                            </div> : <img src={photoSource(image.path)} alt="" decoding="async"
                                onLoad={event => recordSize(image.path, { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                                onError={() => recordSize(image.path, { width: 1, height: 1, failed: true })} />}
                        </div>
                        <div className={styles.caption}>
                            <span className={styles.name} title={image.name}>{image.name}</span>
                            <span className={styles.meta}>
                                <span>{t(`imageLibrary.kind.${image.kind}`)}</span>
                                {size && !size.failed && <span>{size.width} × {size.height}</span>}
                            </span>
                        </div>
                    </button>
                    {selectable && <label className={styles.checkControl} title={t(selected ? 'imageLibrary.deselectImage' : 'imageLibrary.selectImage', { name: image.name })}>
                        <input type="checkbox" checked={selected} disabled={busy} onChange={() => toggleImage(image)}
                            aria-label={t(selected ? 'imageLibrary.deselectImage' : 'imageLibrary.selectImage', { name: image.name })} />
                        <span className={styles.checkMark} aria-hidden="true"><Check size={18} /></span>
                    </label>}
                </div>;
            })}
        </div>
        {!loading && !listError && visibleImages.length === 0 && <div className={styles.empty}>
            <Images size={32} aria-hidden="true" />
            <p>{t(filtered ? 'imageLibrary.noResults' : 'imageLibrary.empty')}</p>
            {filtered && <TN_Button variant="secondary" onClick={resetFilters}>{t('imageLibrary.resetFilters')}</TN_Button>}
        </div>}
        {previewImage && <ImagePreview key={`preview:${previewImage.path}`} image={previewImage} size={dimensions[previewImage.path]}
            inactive={deleteTargets.length > 0 || Boolean(renameTarget)} busy={busy} onDelete={() => requestDelete([previewImage])}
            onRename={() => requestRename(previewImage)}
            onClose={() => { if (!deleteTargets.length && !renameTarget && !busy) setPreviewImage(null); }} />}
        {deleteTargets.length > 0 && <ImageDeleteDialog images={deleteTargets} deleting={deleting} error={deleteError}
            onClose={closeDelete} onConfirm={confirmDelete} />}
        {renameTarget && <ImageRenameDialog key={`rename:${renameTarget.path}`} image={renameTarget} renaming={renaming} error={renameError} onClose={closeRename} onConfirm={confirmRename} />}
    </div>;
}
