import React, { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { ArrowUp, ArrowDown, GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GhostButton, GhostDialog, GhostIconButton } from "../../GhostDesignSystem";
import { useStatsStore } from "../../../store/saving/stats";
import { ShortcutIcon } from "./SiteIcon";
import styles from "./tab_search.module.css";

function BookmarkRow({ item, index, count, busy, onMove, onDelete }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.url, disabled: busy });
    return (
        <li ref={setNodeRef} className={styles.bookmarkRow} style={{
            transform: CSS.Transform.toString(transform), transition,
            zIndex: isDragging ? 1 : undefined,
        }}>
            <button type="button" ref={setActivatorNodeRef} className={styles.bookmarkDrag}
                {...attributes} {...listeners} disabled={busy}
                aria-label={t("search.reorderBookmark", { name: item.label })}>
                <GripVertical size={18} />
            </button>
            <ShortcutIcon url={item.url} enabled />
            <div className={styles.bookmarkDetails}>
                <span className={styles.bookmarkName} title={item.label}>{item.label}</span>
                <span className={styles.bookmarkUrl} title={item.url}>{item.url}</span>
            </div>
            <div className={styles.bookmarkActions}>
                <GhostIconButton icon={<ArrowUp size={16} />} size="small" variant="ghost"
                    aria-label={t("search.moveBookmarkUp", { name: item.label })}
                    disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} />
                <GhostIconButton icon={<ArrowDown size={16} />} size="small" variant="ghost"
                    aria-label={t("search.moveBookmarkDown", { name: item.label })}
                    disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)} />
                <GhostIconButton icon={<Trash2 size={16} />} size="small" variant="ghost"
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
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
        if (!isOpen) return;
        setError("");
        const dialog = contentRef.current?.closest('[role="dialog"]');
        dialog?.querySelector("button")?.focus();
        const trapFocus = (event) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.stopPropagation();
                closeRef.current();
                return;
            }
            if (event.key !== "Tab") return;
            const buttons = [...dialog.querySelectorAll("button:not(:disabled)")];
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
        <GhostDialog isOpen={isOpen} onClose={onClose} title={t("search.bookmarks")} maxWidth="680px">
            <div ref={contentRef} className={styles.bookmarkManager} aria-busy={busy}>
                <p className={styles.bookmarkHint}>{t("search.bookmarkInstructions")}</p>
                {error && <div role="alert">{error}</div>}
                {bookmarks.length === 0 ? <p className={styles.bookmarkHint}>{t("search.noBookmarks")}</p> : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        onDragEnd={({ active, over }) => {
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
                    <GhostButton variant="secondary" onClick={onClose}>{t("common.close")}</GhostButton>
                </div>
            </div>
        </GhostDialog>
    );
}
