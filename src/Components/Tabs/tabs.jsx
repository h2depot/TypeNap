import React, { useEffect, useState } from "react";
import styles from "./tabs.module.css";
import { Home, X, Settings, Folder, Book, FileText, Library } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from "../../store/tabStore";
import { useTxtStore } from "../../store/txtStore";
import GhostDialog from "../GhostDesignSystem/GhostDialog";
import GhostButton from "../GhostDesignSystem/GhostButton";
import TabHome from "../Tab_view/Tab_Home/tab_home";
import TabLibrary from "../Tab_view/Tab_Library/tab_library";

import TabSettings from "../Tab_view/Tab_Settings/tab_settings";
import TabWork from "../Tab_view/Tab_Work/tab_work";
import TabStory from "../Tab_view/Tab_Story/tab_story";
import BackgroundLogo from "../TypeNapLogo/BackgroundLogo";
import { useTranslation } from "react-i18next";

function SortableTab({ id, isActive, children }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`${styles.tab_wrapper} ${isActive ? styles.wrapper_active : ""}`}
        >
            {children}
        </div>
    );
}

export default function Tabs() {
    const { t } = useTranslation();
    const { tabsList, selectedIndex, setSelectedIndex, addTab, closeTab, reorderTabs } = useTabStore();
    const [closeConfirmIndex, setCloseConfirmIndex] = useState(null);
    const [targetTabInfo, setTargetTabInfo] = useState({ story_name: '', file_name: '' });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    function handleDragEnd(event) {
        const { active, over } = event;
        if (!over) return;

        if (active.id !== over.id) {
            const oldIndex = tabsList.findIndex(item => item.id === active.id);
            const newIndex = tabsList.findIndex(item => item.id === over.id);

            reorderTabs(oldIndex, newIndex);
        }
    }

    const requestClose = (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= tabsList.length) return;
        const tab = tabsList[index];
        if (tab && tab.type === 'work') {
            const workspaceId = `${tab.props.story_name}/${tab.props.title}`;
            const workspace = useTxtStore.getState().workspaces[workspaceId];
            if (workspace?.isEdited) {
                setTargetTabInfo({ story_name: tab.props.story_name, file_name: tab.props.title });
                setCloseConfirmIndex(index);
                return;
            }
        }
        closeTab(index);
    };

    const onClose = (e, index) => {
        e.stopPropagation();
        requestClose(index);
    };

    useEffect(() => {
        const handleRequestClose = (event) => {
            requestClose(event.detail?.index);
        };

        window.addEventListener('request-close-tab', handleRequestClose);
        return () => window.removeEventListener('request-close-tab', handleRequestClose);
    });

    const handleConfirmClose = () => {
        if (closeConfirmIndex !== null) {
            closeTab(closeConfirmIndex);
            setCloseConfirmIndex(null);
        }
    };

    const handleCancelClose = () => {
        setCloseConfirmIndex(null);
    };

    const handleAddTestTab = () => {
        addTab('work', `New Tab ${tabsList.length + 1}`);
    };

    const getTabIcon = (type) => {
        switch (type) {
            case 'home': return <Home size={18} />;
            case 'library': return <Library size={18} />;
            case 'settings': return <Settings size={18} />;

            case 'work': return <FileText size={18} />;
            case 'story': return <Book size={18} />;
            default: return <Home size={18} />;
        }
    };

    const renderTabContent = (tab) => {
        if (!tab) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                    <BackgroundLogo />
                </div>
            );
        }
        switch (tab.type) {
            case 'home': return <TabHome {...tab.props} />;
            case 'library': return <TabLibrary {...tab.props} />;

            case 'settings': return <TabSettings {...tab.props} />;
            case 'work': return <TabWork {...tab.props} />;
            case 'story': return <TabStory {...tab.props} />;
            default: return <div>{t("tabs.noContent")}</div>;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.tabswitch_container}>
                <div className={styles.tabswitch_row}>
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors} modifiers={[restrictToHorizontalAxis]}>
                        <SortableContext items={tabsList.map(tab => tab.id)} strategy={horizontalListSortingStrategy}>
                            {tabsList.map((tab, index) => {
                                const isActive = index === selectedIndex;
                                const isLast = index === tabsList.length - 1;
                                const isNextActive = index + 1 === selectedIndex;
                                const showDivider = !isActive && !isLast && !isNextActive;

                                return (
                                    <SortableTab key={tab.id} id={tab.id} isActive={isActive}>
                                        <div
                                            className={`${styles.tab} ${isActive ? styles.tab_active : ""}`}
                                            onClick={() => setSelectedIndex(index)}
                                        >
                                            <div className={styles.tab_header}>
                                                <span className={styles.tab_icon}>{getTabIcon(tab.type)}</span>
                                                <span className={styles.tab_text}>{tab.title}</span>
                                                <button
                                                    className={styles.close_btn}
                                                    onClick={(e) => onClose(e, index)}
                                                    title={t("common.close")}
                                                >
                                                    <X size={15} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className={`${styles.tab_divider} ${showDivider ? "" : styles.divider_hidden}`}></div>
                                    </SortableTab>
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            <div className={styles.divider}></div>

            <div className={styles.content}>
                {renderTabContent(tabsList[selectedIndex])}
            </div>

            <GhostDialog
                isOpen={closeConfirmIndex !== null}
                onClose={handleCancelClose}
                title={t("tabs.unsaved.title")}
                maxWidth="400px"
            >
                <div style={{ marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 10px 0" }}>{t("tabs.unsaved.message")}</p>
                    <div style={{ fontSize: "0.9em", color: "var(--ghost-subtext)", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                        <div><strong>Story:</strong> {targetTabInfo.story_name}</div>
                        <div><strong>File:</strong> {targetTabInfo.file_name}</div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <GhostButton variant="default" onClick={handleCancelClose}>
                        {t("common.cancel")}
                    </GhostButton>
                    <GhostButton variant="danger" onClick={handleConfirmClose}>
                        {t("tabs.unsaved.closeWithoutSaving")}
                    </GhostButton>
                </div>
            </GhostDialog>
        </div>
    );
}
