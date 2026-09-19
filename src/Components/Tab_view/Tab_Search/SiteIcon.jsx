import React, { useEffect, useState } from "react";
import { Bubbles, Search } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useBrowserStore } from "../../../store/webbrowser/browserStore";

export function SiteIcon({ icon, size = 20, fallback = "Search" }) {
    const [failedIcon, setFailedIcon] = useState(null);
    if (icon === "Search") return <Search size={size} />;
    if (!icon || icon === failedIcon || !/^(https:|data:image\/)/i.test(icon)) {
        return fallback === "Bubbles" ? <Bubbles size={size} /> : <Search size={size} />;
    }
    return <img src={icon} alt="" width={size} height={size} draggable={false}
        referrerPolicy="no-referrer" style={{ objectFit: "contain", flexShrink: 0 }}
        onError={() => setFailedIcon(icon)} />;
}

export function ShortcutIcon({ url, enabled }) {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        if (!enabled || !isTauri()) return;
        let disposed = false;
        useBrowserStore.getState().getSiteInfo(url).then((result) => {
            if (!disposed) setInfo({ url, icon: result.icon });
        });
        return () => { disposed = true; };
    }, [url, enabled]);
    return <SiteIcon icon={info?.url === url ? info.icon : null} fallback="Bubbles" />;
}
