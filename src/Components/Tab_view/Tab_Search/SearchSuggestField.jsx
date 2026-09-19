import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { GhostTextField, GhostURLField } from "../../GhostDesignSystem";
import { useBrowserStore } from "../../../store/webbrowser/browserStore";
import { createSuggestionLoader } from "../../../store/webbrowser/suggestionLoader";
import styles from "./tab_search.module.css";

export default function SearchSuggestField({ value, onChange, onSubmit, enabled, toolbar = false, onFocusChange, ...props }) {
    const { t } = useTranslation();
    const listId = useId();
    const wrapper = useRef(null);
    const [focused, setFocused] = useState(false);
    const [composing, setComposing] = useState(false);
    const [query, setQuery] = useState("");
    const [result, setResult] = useState({ query: "", items: [] });
    const [selected, setSelected] = useState(-1);
    const loader = useMemo(() => createSuggestionLoader((input) => useBrowserStore.getState().getSuggestions(input)), []);
    const items = enabled && focused && !composing && query && result.query === value && query === value ? result.items : [];
    const close = () => {
        loader.cancel();
        setQuery("");
        setResult({ query: "", items: [] });
        setSelected(-1);
    };
    useEffect(() => {
        if (!enabled || !focused || composing || !query || query !== value || !isTauri()) return;
        loader.load(query, (suggestions) => {
            setResult({ query, items: suggestions });
            setSelected(-1);
        });
        return loader.cancel;
    }, [query, value, enabled, focused, composing, loader]);

    useEffect(() => {
        if (selected >= 0) wrapper.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    const submit = (text) => {
        close();
        wrapper.current?.querySelector("input")?.blur();
        onSubmit(text);
    };
    const Field = toolbar ? GhostURLField : GhostTextField;
    return <div ref={wrapper} className={`${styles.suggestField} ${toolbar ? styles.suggestToolbar : ""}`}>
        <Field {...props} value={value}
            role="combobox" aria-autocomplete="list" aria-expanded={items.length > 0}
            aria-controls={items.length ? listId : undefined}
            aria-activedescendant={selected >= 0 && items[selected] ? `${listId}-${selected}` : undefined}
            aria-label={t("search.centerPlaceholder", "Web を検索、または URL を入力")}
            autoComplete="off"
            onFocus={() => { setFocused(true); onFocusChange?.(true); }}
            onBlur={() => { setFocused(false); setComposing(false); close(); onFocusChange?.(false); }}
            onChange={(event) => {
                loader.cancel();
                setResult({ query: "", items: [] });
                setSelected(-1);
                setQuery(event.target.value);
                onChange(event);
            }}
            onCompositionStart={() => { setComposing(true); loader.cancel(); }}
            onCompositionEnd={(event) => { setComposing(false); setQuery(event.currentTarget.value); }}
            onKeyDown={(event) => {
                if (composing || event.nativeEvent.isComposing || event.keyCode === 229) return;
                if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
                    event.preventDefault();
                    setSelected((index) => event.key === "ArrowDown" ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1));
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                } else if (event.key === "Enter") {
                    event.preventDefault();
                    submit(items[selected] || value);
                }
            }}
        />
        {items.length > 0 && <div id={listId} role="listbox" aria-label={t("search.suggestions", "検索候補")} className={styles.suggestions}>
            {items.map((item, index) => <button key={item} id={`${listId}-${index}`} type="button"
                role="option" aria-selected={index === selected} tabIndex={-1}
                className={`${styles.suggestion} ${index === selected ? styles.suggestionSelected : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => submit(item)}>
                <Search size={15} aria-hidden="true" /><span>{item}</span>
            </button>)}
        </div>}
    </div>;
}
