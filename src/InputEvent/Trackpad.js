import { useEffect, useRef } from "react";
import { useTabStore } from "../store/tabStore";

export default function Trackpad() {
    const lastTriggerTime = useRef(0);
    const cooldownMs = 200; 

    useEffect(() => {
        const handleWheel = (event) => {
            if (Math.abs(event.deltaX) < 20) return;

            const now = Date.now();
            if (now - lastTriggerTime.current < cooldownMs) return;

            const { tabsList, selectedIndex, setSelectedIndex } = useTabStore.getState();
            const count = tabsList.length;
            if (count <= 1) return;

            lastTriggerTime.current = now;

            if (event.deltaX < -20) {
                setSelectedIndex((selectedIndex + 1) % count);
            } else if (event.deltaX > 20) {
                setSelectedIndex((selectedIndex - 1 + count) % count);
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: true });

        return () => {
            window.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return null;
}
