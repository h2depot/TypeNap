import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Trash2 } from '../../../assets/IconList';
import { photoSource } from '../../../assets/photoImages.js';
import { TN_Button, TN_Dialog, TN_IconButton, TN_TextField } from '../../TNDesignSystem';
import styles from './ImageView.module.css';

function ImageDialog({ title, maxWidth, inactive = false, onClose, children, initialFocus = 'button' }) {
    const dialog = useRef(null);
    const wasInactive = useRef(inactive);
    useEffect(() => {
        const previousFocus = document.activeElement;
        dialog.current?.querySelector(initialFocus)?.focus({ preventScroll: true });
        return () => {
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            else document.querySelector('[data-image-library-search]')?.focus({ preventScroll: true });
        };
    }, [initialFocus]);
    useEffect(() => {
        if (wasInactive.current && !inactive) dialog.current?.querySelector(initialFocus)?.focus({ preventScroll: true });
        wasInactive.current = inactive;
    }, [inactive, initialFocus]);

    return createPortal(<div ref={dialog} inert={inactive} aria-hidden={inactive || undefined} onKeyDown={event => {
        event.stopPropagation();
        if (inactive) return;
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
            const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')];
            const first = buttons[0], last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }}>
        <TN_Dialog isOpen title={title} onClose={onClose} maxWidth={maxWidth}>{children}</TN_Dialog>
    </div>, document.body);
}

export function ImagePreview({ image, size, inactive, busy, onClose, onDelete, onRename }) {
    const { t, i18n } = useTranslation();
    const [failed, setFailed] = useState(false);
    const date = value => value ? new Date(value * 1000).toLocaleString(i18n.language) : '—';
    return <ImageDialog title={t('imageLibrary.preview')} onClose={onClose} maxWidth="1000px" inactive={inactive}>
        <div className={styles.previewContent}>
            <div className={styles.preview}>
                {failed || size?.failed ? <p role="status">{t('imageLibrary.imageFailed')}</p>
                    : <img src={photoSource(image.path)} alt={image.name} onError={() => setFailed(true)} />}
            </div>
            <div className={styles.previewHeading}>
                <p className={styles.previewName} >{image.name}</p>
                <div className={styles.previewActions}>
                    {image.kind === 'user' && <TN_Button variant="secondary" size="small" disabled={busy} onClick={onRename}>{t('common.rename')}</TN_Button>}
                    <TN_IconButton icon={<Trash2 size={18} />} size="small" onClick={onDelete} disabled={busy || image.kind !== 'user'}
                        aria-label={t('common.delete')} />
                </div>
            </div>
            <dl className={styles.details}>
                <div><dt>{t('imageLibrary.kind.label')}</dt><dd>{t(`imageLibrary.kind.${image.kind}`)}</dd></div>
                {size && !size.failed && <div><dt>{t('imageLibrary.dimensions')}</dt><dd>{size.width} × {size.height} px</dd></div>}
                <div><dt>{t('library.details.createdAt')}</dt><dd>{date(image.created_at)}</dd></div>
                <div><dt>{t('library.details.lastUpdated')}</dt><dd>{date(image.last_update)}</dd></div>
            </dl>
            {image.kind !== 'user' && <p className={styles.presetHint}>{t('imageLibrary.presetProtected')}</p>}
        </div>
    </ImageDialog>;
}

export function ImageRenameDialog({ image, renaming, error, onClose, onConfirm }) {
    const { t } = useTranslation();
    const dot = image.name.lastIndexOf('.');
    const extension = dot > 0 ? image.name.slice(dot) : '';
    const [name, setName] = useState(dot > 0 ? image.name.slice(0, dot) : image.name);
    return <ImageDialog title={t('imageLibrary.renameTitle')} onClose={onClose} maxWidth="500px" initialFocus="[data-image-rename-name]">
        <form aria-busy={renaming} onSubmit={event => { event.preventDefault(); if (!renaming && name.trim()) void onConfirm(`${name.trim()}${extension}`); }}>
            <label className={styles.renameLabel} htmlFor="image-rename-name">{t('imageLibrary.renameName')}</label>
            <TN_TextField id="image-rename-name" value={name} onChange={event => setName(event.target.value)} disabled={renaming}
                data-image-rename-name autoComplete="off" maxLength={100 - extension.length} required />
            <p className={styles.presetHint}>{t('imageLibrary.renameExtension', { extension })}</p>
            {error && <p className={styles.errorDetail} role="alert">{error}</p>}
            <div className={styles.dialogActions}>
                <TN_Button variant="secondary" disabled={renaming} onClick={onClose}>{t('common.cancel')}</TN_Button>
                <TN_Button type="submit" variant="proceed" disabled={renaming || !name.trim()}>{t(renaming ? 'imageLibrary.renaming' : 'common.rename')}</TN_Button>
            </div>
        </form>
    </ImageDialog>;
}

export function ImageDeleteDialog({ images, deleting, error, onClose, onConfirm }) {
    const { t } = useTranslation();
    return <ImageDialog title={t('common.deleteConfirmation')} onClose={onClose} maxWidth="500px" initialFocus="[data-delete-cancel]">
        <div aria-busy={deleting}>
            <p className={styles.deleteMessage}>{t(images.length === 1 ? 'imageLibrary.deleteSingle' : 'imageLibrary.deleteMultiple', {
                name: images[0]?.name, count: images.length,
            })}</p>
            <ul className={styles.deleteList}>{images.map(image => <li key={image.path}>{image.name}</li>)}</ul>
            <p className={styles.deleteHint}>{t('imageLibrary.deleteHint')}</p>
            {error && <p className={styles.errorDetail} role="alert">{error}</p>}
            <div className={styles.dialogActions}>
                <TN_Button variant="secondary" disabled={deleting} onClick={onClose} data-delete-cancel>{t('common.cancel')}</TN_Button>
                <TN_Button variant="danger" disabled={deleting || !images.length} onClick={onConfirm}>
                    {t(deleting ? 'common.deleting' : 'common.delete')}
                </TN_Button>
            </div>
        </div>
    </ImageDialog>;
}
