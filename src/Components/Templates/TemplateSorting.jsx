import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useRef } from 'react';
import styles from '../JSONBox/jsonbox.module.css';

const templateId = entry => entry.definition.id;
export function TemplateSortContext({ stack, onChange, children, getId = templateId, disabled = false }) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    return <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={({ active, over }) => {
        if (disabled || !over || active.id === over.id) return;
        const from = stack.findIndex(entry => getId(entry) === active.id);
        const to = stack.findIndex(entry => getId(entry) === over.id);
        if (from >= 0 && to >= 0) onChange(arrayMove(stack, from, to));
    }}>
        <SortableContext items={stack.map(getId)} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>;
}

export function SortableTemplate({ id, name, sidebar = false, onNavigate, onSectionRef, children, className = '', disabled = false }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
    const suppressClick = useRef(false);
    if (isDragging) suppressClick.current = true;
    const start = (event, listener) => {
        if (disabled) return;
        const interactive = event.target.closest('input, textarea, button, select, a, [contenteditable="true"], [role="combobox"], [role="button"]');
        if (interactive && !interactive.hasAttribute('data-template-heading')) return;
        suppressClick.current = false;
        listener?.(event);
    };
    return <div {...attributes} role="group" ref={node => { setNodeRef(node); if (!sidebar) setActivatorNodeRef(node); onSectionRef?.(id, node); }} tabIndex={sidebar || disabled ? -1 : 0}
        className={`${sidebar ? styles.sortableMenuItem : `${styles.propertiesTarget} ${styles.sortableTemplate}`} ${className}`} data-dragging={isDragging || undefined}
        style={{ transform: CSS.Transform.toString(transform), transition }} aria-label={name}
        onKeyDown={event => { if (!disabled && event.target === event.currentTarget) listeners?.onKeyDown?.(event); }}
        onMouseDown={event => start(event, listeners?.onMouseDown)} onTouchStart={event => start(event, listeners?.onTouchStart)}
        onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        {sidebar ? <button type="button" ref={setActivatorNodeRef} {...attributes} onKeyDown={listeners?.onKeyDown} className={styles.menuItem} data-template-heading onClick={onNavigate}>{children}</button> : children}
    </div>;
}
