import { workspaceTabTypes } from "./workspaceTabTypes";
import React, { useEffect, useState } from "react";
import styles from "./workspace.module.css";
import WindowControls from "../WindowControls/WindowControls";

import { X, Plus, LeftArrow } from '../../assets/IconList';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from "../../store/tabStore";
import { useTxtStore } from "../../store/txtStore";
import TN_Dialog from "../TNDesignSystem/TN_Dialog";
import TN_Button from "../TNDesignSystem/TN_Button";
import { SiteIcon } from "../Tab_view/Tab_Search/SiteIcon";
import { useTranslation } from "react-i18next";
import TabLauncher from "./TabLauncher";

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

export default function WorkspaceTabs() {
    const { t } = useTranslation();
    const { appMode, setAppMode, tabsList, selectedIndex, setSelectedIndex, addTab, closeTab, reorderTabs } = useTabStore();
    const [closeConfirmId, setCloseConfirmId] = useState(null);
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
                setCloseConfirmId(tab.id);
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
            if (useTabStore.getState().appMode === "workspace") requestClose(event.detail?.index);
        };

        window.addEventListener('request-close-tab', handleRequestClose);
        return () => window.removeEventListener('request-close-tab', handleRequestClose);
    });

    const handleConfirmClose = () => {
        if (closeConfirmId !== null) {
            closeTab(tabsList.findIndex((tab) => tab.id === closeConfirmId));
            setCloseConfirmId(null);
        }
    };

    const handleCancelClose = () => {
        setCloseConfirmId(null);
    };

    return (
        <>
            <div className={styles.window_header} data-tauri-drag-region>
                <span className={styles.modeLabel} data-tauri-drag-region>
                    {t(appMode === "workspace" ? "navigation.workspace" : appMode === "library" ? "library.title" : "settings.title")}
                </span>
                {appMode === "workspace" ? <>
                <div className={styles.tabswitch_row} data-tauri-drag-region>
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
                                            onClick={() => { setSelectedIndex(index); setAppMode("workspace"); }}
                                        >
                                            <div className={styles.tab_header}>
                                                <span className={styles.tab_icon}>{tab.type === "search"
                                                    ? <SiteIcon size={16} icon={tab.props?.url && tab.props.siteInfoUrl === tab.props.url ? tab.props.siteIcon : "Search"} />
                                                    : React.createElement(workspaceTabTypes[tab.type]?.icon || Plus, { size: 16 })}</span>
                                                <span className={styles.tab_text}>{tab.type === "search" && (!tab.props?.url || (tab.props.siteInfoUrl !== tab.props.url && tab.props.liveTitleUrl !== tab.props.url)) ? "Search" : tab.title}</span>
                                                <button
                                                    className={styles.close_btn}
                                                    onClick={(e) => onClose(e, index)}
                                                    title={t("common.close")}
                                                >
                                                    <X size={14} />
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
                </> : <button type="button" className={styles.resumeWorkspace}
                    onClick={() => setAppMode("workspace")}>
                    <LeftArrow size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span>{t("navigation.resume")}</span>
                    {tabsList.length > 0 && <span className={styles.tabCount}>{t("navigation.openTabs", { count: tabsList.length })}</span>}
                </button>}
                <TabLauncher />
                <div className={styles.window_drag_region} data-tauri-drag-region />
                <WindowControls />
            </div>

            <TN_Dialog
                isOpen={closeConfirmId !== null}
                onClose={handleCancelClose}
                title={t("tabs.unsaved.title")}
                maxWidth="400px"
            >
                <div style={{ marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 10px 0" }}>{t("tabs.unsaved.message")}</p>
                    <div style={{ fontSize: "0.9em", color: "var(--tn-subtext)", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                        <div><strong>Story:</strong> {targetTabInfo.story_name}</div>
                        <div><strong>File:</strong> {targetTabInfo.file_name}</div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <TN_Button variant="default" onClick={handleCancelClose}>
                        {t("common.cancel")}
                    </TN_Button>
                    <TN_Button variant="proceed" onClick={handleConfirmClose}>
                        {t("tabs.unsaved.closeWithoutSaving")}
                    </TN_Button>
                </div>
            </TN_Dialog>
        </>
    );
}
