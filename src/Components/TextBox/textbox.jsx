import React, { useMemo, useRef, useState, useEffect } from "react";
import styles from "./textbox.module.css";
import GhostIconButton from "../GhostDesignSystem/GhostIconButton";
import GhostTooltip from "../GhostDesignSystem/GhostTooltip";
import { CircleCheck, CircleAlert, ArrowRight, ArrowDown, Search, ArrowUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function TextBox({ workspaceId, title, content, onChangeContent, isTitleEdible = false, setIsTitleEdible, onRename, isSaved, onSaveClick, charLength, fontSize }) {
    const { t } = useTranslation();
    const [isVertical, setIsVertical] = useState(false);
    const [editedTitle, setEditedTitle] = useState(title);
    const [selectedCharLength, setSelectedCharLength] = useState(0);
    const [selectedVisible, setSelectedVisible] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [serchQuery, setSerchQuery] = useState("");
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const normalizedSearchQuery = serchQuery.trim();
    const bodyContent = content || "";

    const searchMatches = useMemo(() => {
        if (!normalizedSearchQuery) {
            return [];
        }

        const matcher = new RegExp(escapeRegExp(normalizedSearchQuery), "gi");
        return Array.from(bodyContent.matchAll(matcher), (match) => ({
            start: match.index,
            end: match.index + match[0].length,
        }));
    }, [bodyContent, normalizedSearchQuery]);

    const highlightedContent = useMemo(() => {
        if (!normalizedSearchQuery || searchMatches.length === 0) {
            return bodyContent;
        }

        const fragments = [];
        let cursor = 0;

        searchMatches.forEach((match, index) => {
            if (match.start > cursor) {
                fragments.push(bodyContent.slice(cursor, match.start));
            }

            fragments.push(
                <mark
                    key={`${match.start}-${match.end}`}
                    className={index === activeSearchIndex ? styles.searchMarkActive : styles.searchMark}
                >
                    {bodyContent.slice(match.start, match.end)}
                </mark>
            );
            cursor = match.end;
        });

        if (cursor < bodyContent.length) {
            fragments.push(bodyContent.slice(cursor));
        }

        return fragments;
    }, [activeSearchIndex, bodyContent, normalizedSearchQuery, searchMatches]);

    useEffect(() => {
        setEditedTitle(title);
    }, [title]);

    useEffect(() => {
        setActiveSearchIndex(0);
    }, [normalizedSearchQuery]);

    useEffect(() => {
        if (activeSearchIndex >= searchMatches.length) {
            setActiveSearchIndex(Math.max(searchMatches.length - 1, 0));
        }
    }, [activeSearchIndex, searchMatches.length]);

    const toggleWritingMode = () => {
        setIsVertical(!isVertical);
    };

    const toggleSearch = () => {
        setSearchVisible(!searchVisible);
    };

    useEffect(() => {
        const handleOpenSearch = (e) => {
            if (e.detail.workspaceID === workspaceId) {
                toggleSearch();
            }
        };
        window.addEventListener('open-search', handleOpenSearch);
        return () => window.removeEventListener('open-search', handleOpenSearch);
    }, [workspaceId, searchVisible]);

    const handleInputClick = () => {
        if (!isTitleEdible) {
            setIsTitleEdible(true);
        }
    };

    const handleSelect = (e) => {
        const length = e.target.selectionEnd - e.target.selectionStart;
        setSelectedCharLength(length);
        setSelectedVisible(length > 0);
    };

    const syncHighlightScroll = (e) => {
        if (!highlightRef.current) {
            return;
        }

        highlightRef.current.scrollTop = e.target.scrollTop;
        highlightRef.current.scrollLeft = e.target.scrollLeft;
    };

    const moveSearchResult = (direction) => {
        if (searchMatches.length === 0) {
            return;
        }

        const nextIndex = (activeSearchIndex + direction + searchMatches.length) % searchMatches.length;
        const nextMatch = searchMatches[nextIndex];

        setActiveSearchIndex(nextIndex);
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextMatch.start, nextMatch.end);
    };

    const handleSave = () => {
        if (isTitleEdible) {
            if (editedTitle.trim() && editedTitle !== title) {
                onRename(editedTitle);
            } else {
                setEditedTitle(title);
            }
            setIsTitleEdible(false);
        }
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSave();
            e.target.blur(); 
        } else if (e.key === "Escape") {
            setEditedTitle(title);
            setIsTitleEdible(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                {searchVisible && <div className={styles.searchUi}>
                    <Search size={16} className={styles.searchIcon} />
                    <input type="text" placeholder="Search..." className={styles.searchInput} value={serchQuery} onChange={(e) => setSerchQuery(e.target.value)} />
                    <span className={styles.searchResultText}>
                        {normalizedSearchQuery
                            ? searchMatches.length > 0
                                ? `${activeSearchIndex + 1} / ${searchMatches.length}`
                                : t("editor.search.noResults")
                            : t("editor.search.label")}
                    </span>
                    <button className={styles.icon_btn} onClick={() => moveSearchResult(-1)} disabled={searchMatches.length === 0}><ArrowUp size={16} /></button>
                    <button className={styles.icon_btn} onClick={() => moveSearchResult(1)} disabled={searchMatches.length === 0}><ArrowDown size={16} /></button>
                    <button className={styles.icon_btn} onClick={() => { setSearchVisible(false); setSerchQuery(""); }}><X size={16} /></button>
                </div>}

                <div className={styles.toolbarRight}>
                    {charLength !== undefined && (
                        <span className={styles.charLength}>
                            {selectedVisible ? `${selectedCharLength} / ` : ''}{t("common.characterCount", { count: charLength })}
                        </span>
                    )}
                    <button
                        className={`${styles.saveStatus} ${isSaved ? styles.saved : styles.unsaved}`}
                        onClick={onSaveClick}
                    >
                        {isSaved ? <><CircleCheck size={16} /> {t("editor.saved")}</> : <><CircleAlert size={16} /> {t("editor.unsaved")}</>}
                    </button>
                    <GhostTooltip content={t(isVertical ? "editor.writingMode.horizontal" : "editor.writingMode.vertical")} position="left">
                        <GhostIconButton
                            icon={isVertical ? <ArrowRight /> : <ArrowDown />}
                            onClick={toggleWritingMode}
                            variant="secondary"
                            size="small"
                        />
                    </GhostTooltip>
                </div>
            </div>

            <div className={`${styles.contentWrapper} ${isVertical ? styles.vertical : styles.horizontal}`}>
                <div className={styles.textareaContainer}>
                    <input
                        type="text"
                        className={`${styles.titlebox} ${isTitleEdible ? styles.edible : styles.clickable}`}
                        placeholder={t("editor.titlePlaceholder")}
                        value={isTitleEdible ? editedTitle : (title || "")}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={handleSave}
                        onClick={handleInputClick}
                        onKeyDown={handleTitleKeyDown}
                        readOnly={!isTitleEdible}
                        autoFocus={isTitleEdible}
                    />
                    <div className={styles.divider}></div>
                    <div className={styles.editorShell}>
                        <div
                            ref={highlightRef}
                            className={styles.highlightLayer}
                            aria-hidden="true"
                            style={{
                                fontSize: `${fontSize}px`
                            }}
                        >
                            {highlightedContent}
                        </div>
                        <textarea
                            ref={textareaRef}
                            className={styles.textbox}
                            placeholder={t("editor.bodyPlaceholder")}
                            value={bodyContent}
                            onChange={(e) => onChangeContent(e.target.value)}
                            onSelect={handleSelect}
                            onScroll={syncHighlightScroll}
                            spellCheck={false}
                            style={{
                                fontSize: `${fontSize}px`
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
