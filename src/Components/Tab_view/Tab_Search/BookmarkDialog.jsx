import React, { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Trash2, UpArrow, DownArrow } from '../../../assets/IconList';
import { useTranslation } from "react-i18next";
import { TN_Button, TN_Dialog, TN_IconButton } from "../../TNDesignSystem";
import { useStatsStore } from "../../../store/saving/stats";
import { ShortcutIcon } from "./SiteIcon";
import styles from "./tab_search.module.css";

export function BookmarkRow({ item, index, count, busy, onMove, onDelete }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.url, disabled: busy });
    const suppressClick = useRef(false);
    if (isDragging) suppressClick.current = true;
    const start = (event, listener) => {
        if (busy || event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
        suppressClick.current = false;
        listener?.(event);
    };
    return (
        <li {...attributes} role="listitem" ref={node => { setNodeRef(node); setActivatorNodeRef(node); }} tabIndex={busy ? -1 : 0}
            aria-label={t("search.reorderBookmark", { name: item.label })} className={styles.bookmarkRow} data-dragging={isDragging || undefined} style={{
            transform: CSS.Transform.toString(transform), transition,
            zIndex: isDragging ? 1 : undefined,
        }} onMouseDown={event => start(event, listeners?.onMouseDown)} onTouchStart={event => start(event, listeners?.onTouchStart)}
            onKeyDown={event => { if (!busy && event.target === event.currentTarget) listeners?.onKeyDown?.(event); }}
            onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
            <ShortcutIcon url={item.url} enabled />
            <div className={styles.bookmarkDetails}>
                <span className={styles.bookmarkName} >{item.label}</span>
                <span className={styles.bookmarkUrl} >{item.url}</span>
            </div>
            <div className={styles.bookmarkActions}>
                <TN_IconButton icon={<UpArrow size={16} />} size="small" variant="ghost"
                    aria-label={t("search.moveBookmarkUp", { name: item.label })}
                    disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} />
                <TN_IconButton icon={<DownArrow size={16} />} size="small" variant="ghost"
                    aria-label={t("search.moveBookmarkDown", { name: item.label })}
                    disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)} />
                <TN_IconButton icon={<Trash2 size={16} />} size="small" variant="ghost"
                    aria-label={t("search.deleteBookmark", { name: item.label })}
                    disabled={busy} onClick={() => onDelete(item.url)} />
            </div>
        </li>
    );
}

export default function BookmarkDialog({ isOpen, onClose }) {
    const { t } = useTranslation();
    const bookmarks = useStatsStore((state) => state.stats.bookmarks);
    const ready = useStatsStore((state) => state.isReady);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState("");
    const contentRef = useRef(null);
    const draggingRef = useRef(false);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
        if (!isOpen) return;
        setError("");
        const dialog = contentRef.current?.closest('[role="dialog"]');
        dialog?.querySelector("button")?.focus();
        const trapFocus = (event) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                if (draggingRef.current) return;
                event.stopPropagation();
                closeRef.current();
                return;
            }
            if (event.key !== "Tab") return;
            const buttons = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        dialog?.addEventListener("keydown", trapFocus);
        return () => dialog?.removeEventListener("keydown", trapFocus);
    }, [isOpen]);

    const save = async (operation) => {
        if (busyRef.current || !ready) return;
        busyRef.current = true;
        setBusy(true);
        setError("");
        try {
            await operation();
        } catch (err) {
            setError(t("common.errorWithDetail", { message: t("search.bookmarkSaveFailed"), error: String(err) }));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };
    const move = (from, to) => {
        if (!bookmarks[from] || !bookmarks[to]) return;
        void save(() => useStatsStore.getState().moveBookmark(bookmarks[from].url, bookmarks[to].url));
    };

    return (
        <TN_Dialog isOpen={isOpen} onClose={onClose} title={t("search.bookmarks")} maxWidth="680px">
            <div ref={contentRef} className={styles.bookmarkManager} aria-busy={busy}>
                <p className={styles.bookmarkHint}>{t("search.bookmarkInstructions")}</p>
                {error && <div role="alert">{error}</div>}
                {bookmarks.length === 0 ? <p className={styles.bookmarkHint}>{t("search.noBookmarks")}</p> : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        onDragStart={() => { draggingRef.current = true; }}
                        onDragCancel={() => { draggingRef.current = false; }}
                        onDragEnd={({ active, over }) => {
                            draggingRef.current = false;
                            if (over && active.id !== over.id) {
                                void save(() => useStatsStore.getState().moveBookmark(active.id, over.id));
                            }
                        }}>
                        <SortableContext items={bookmarks.map((item) => item.url)} strategy={verticalListSortingStrategy}>
                            <ul className={styles.bookmarkList}>
                                {bookmarks.map((item, index) => <BookmarkRow key={item.url} item={item} index={index}
                                    count={bookmarks.length} busy={busy || !ready} onMove={move}
                                    onDelete={(url) => { void save(() => useStatsStore.getState().removeBookmark(url)); }} />)}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}
                <div className={styles.shortcutActions}>
                    <TN_Button variant="secondary" onClick={onClose}>{t("common.close")}</TN_Button>
                </div>
            </div>
        </TN_Dialog>
    );
}
