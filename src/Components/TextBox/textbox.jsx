import React, { useRef, useState, useEffect } from "react";
import styles from "./textbox.module.css";
import TN_IconButton from "../TNDesignSystem/TN_IconButton";
import TN_Tooltip from "../TNDesignSystem/TN_Tooltip";
import { Search, X, LeftArrow, DownArrow, UpArrow, Save } from '../../assets/IconList';
import { useTranslation } from "react-i18next";

import { EditorContent, useEditor } from '@tiptap/react';
import { PlainStarterKit, PlainParagraph, PlainTextClipboard, textToDocument, documentToText } from './plainTextEditor';
import { SearchHighlight, searchHighlightKey } from './searchHighlight';

export default function TextBox({ workspaceId, title, content, onChangeContent, isTitleEdible = false, setIsTitleEdible, onRename, isSaved, onSaveClick, charLength, fontSize }) {
    const { t } = useTranslation();
    const [isVertical, setIsVertical] = useState(false);
    const [editedTitle, setEditedTitle] = useState(title);
    const [selectedCharLength, setSelectedCharLength] = useState(0);
    const [selectedVisible, setSelectedVisible] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const searchInputRef = useRef(null);
    const normalizedSearchQuery = searchQuery.trim();
    const bodyContent = content || "";

    const [searchMatches, setSearchMatches] = useState([]);
    const editor = useEditor({
        extensions: [PlainStarterKit, PlainParagraph, PlainTextClipboard,
            SearchHighlight.configure({ match: styles.searchMark, active: styles.searchMarkActive })],
        content: textToDocument(bodyContent),
        enableInputRules: false,
        enablePasteRules: false,
        editorProps: {
            attributes: {
                class: styles.textbox, spellcheck: 'false', 'data-typenap-editor': 'true',
                role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('editor.bodyPlaceholder'),
            },
        },
        onUpdate: ({ editor }) => onChangeContent(documentToText(editor.state.doc)),
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            const length = editor.state.doc.textBetween(from, to, '\n').length;
            setSelectedCharLength(length);
            setSelectedVisible(length > 0);
        },
        onTransaction: ({ editor }) => {
            const search = searchHighlightKey.getState(editor.state);
            setSearchMatches(search.matches);
            setActiveSearchIndex(search.activeIndex);
        },
    }, [workspaceId]);

    useEffect(() => {
        if (!editor) return;
        const normalizedContent = bodyContent.replace(/\r\n?/g, '\n');
        if (documentToText(editor.state.doc) !== normalizedContent) {
            editor.commands.setContent(textToDocument(bodyContent), { emitUpdate: false });
        }
    }, [editor, bodyContent]);

    useEffect(() => {
        if (!editor) return;
        editor.commands.setTextBoxSearch(searchVisible ? normalizedSearchQuery : '', 0);
    }, [editor, normalizedSearchQuery, searchVisible]);

    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom;
        dom.typenapEditor = editor;
        return () => { delete dom.typenapEditor; };
    }, [editor]);

    useEffect(() => {
        setEditedTitle(title);
    }, [title]);

    const toggleWritingMode = () => {
        setIsVertical(!isVertical);
    };

    useEffect(() => {
        const handleOpenSearch = (e) => {
            if (e.detail?.workspaceID === workspaceId) {
                setSearchVisible((visible) => !visible);
            }
        };
        const closeSearch = () => setSearchVisible(false);
        window.addEventListener('open-search', handleOpenSearch);
        window.addEventListener('close-dialogs', closeSearch);
        return () => {
            window.removeEventListener('open-search', handleOpenSearch);
            window.removeEventListener('close-dialogs', closeSearch);
        };
    }, [workspaceId]);

    useEffect(() => {
        if (searchVisible) searchInputRef.current?.focus();
    }, [searchVisible]);

    const handleInputClick = () => {
        if (!isTitleEdible) {
            setIsTitleEdible(true);
        }
    };

    const moveSearchResult = (direction) => {
        if (!editor || searchMatches.length === 0) return;
        const nextIndex = (activeSearchIndex + direction + searchMatches.length) % searchMatches.length;
        const nextMatch = searchMatches[nextIndex];
        editor.chain().setTextBoxSearch(normalizedSearchQuery, nextIndex)
            .setTextSelection(nextMatch).focus().scrollIntoView().run();
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
        if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229 || e.nativeEvent?.keyCode === 229) return;
        if (e.key === "Enter") {
            // Blur is the single commit path for both Enter and focus changes.
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
                    <input ref={searchInputRef} type="text" placeholder="Search..." className={styles.searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <span className={styles.searchResultText}>
                        {normalizedSearchQuery
                            ? searchMatches.length > 0
                                ? `${activeSearchIndex + 1} / ${searchMatches.length}`
                                : t("editor.search.noResults")
                            : t("editor.search.label")}
                    </span>
                    <button className={styles.icon_btn} onClick={() => moveSearchResult(-1)} disabled={searchMatches.length === 0}><UpArrow size={16} /></button>
                    <button className={styles.icon_btn} onClick={() => moveSearchResult(1)} disabled={searchMatches.length === 0}><DownArrow size={16} /></button>
                    <button className={styles.icon_btn} onClick={() => { setSearchVisible(false); setSearchQuery(""); }}><X size={16} /></button>
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
                        <Save size={16} /> {t(isSaved ? "editor.saved" : "editor.unsaved")}
                    </button>
                    <TN_Tooltip content={t(isVertical ? "editor.writingMode.horizontal" : "editor.writingMode.vertical")} position="left">
                        <TN_IconButton
                            icon={isVertical ? <LeftArrow /> : <DownArrow />}
                            onClick={toggleWritingMode}
                            variant="secondary"
                            size="small"
                        />
                    </TN_Tooltip>
                </div>
            </div>

            <div className={`${styles.contentWrapper} ${isVertical ? styles.vertical : styles.horizontal}`}>
                <div className={styles.editorContainer}>
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
                        <EditorContent
                            editor={editor}
                            className={styles.editorContent}
                            style={{ fontSize: `${fontSize ?? 16}px` }}
                        />
                        {editor?.isEmpty && <div className={styles.bodyPlaceholder}
                            style={{ fontSize: `${fontSize ?? 16}px` }} aria-hidden="true">
                            {t("editor.bodyPlaceholder")}
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
