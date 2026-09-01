import { Children, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GhostIconButton } from "../GhostDesignSystem";
import TypeNapLogo from "../TypeNapLogo/SplashScreen";
import styles from "./SplashScreen.module.css";

function SplashScreen({ theme = "dark", tourPages = [], tourCompleted = null, onComplete, onTourComplete }) {
    const { t } = useTranslation();
    const [showLogo, setShowLogo] = useState(true);
    const [logoFinished, setLogoFinished] = useState(false);
    const [page, setPage] = useState(0);
    const [direction, setDirection] = useState(1);
    const advancedFromLogo = useRef(false);
    const pages = Children.toArray(tourPages);

    useEffect(() => {
        if (!logoFinished || tourCompleted === null || advancedFromLogo.current) return;

        advancedFromLogo.current = true;
        if (tourCompleted || pages.length === 0) onComplete?.();
        else setShowLogo(false);
    }, [logoFinished, tourCompleted, onComplete, pages.length]);

    const moveTo = (nextPage) => {
        if (nextPage < 0 || nextPage >= pages.length) return;
        setDirection(nextPage > page ? 1 : -1);
        setPage(nextPage);
    };

    const handleNext = () => {
        if (page === pages.length - 1) onTourComplete?.();
        else moveTo(page + 1);
    };

    if (showLogo) {
        return (
            <motion.div className={styles.fullscreen} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <TypeNapLogo theme={theme} onComplete={() => setLogoFinished(true)} />
            </motion.div>
        );
    }

    return (
        <div className={styles.fullscreen}>
            <div className={styles.ambient} aria-hidden="true" />

            <AnimatePresence mode="wait" custom={direction}>
                <motion.main
                    key={pages[page].key ?? page}
                    className={styles.page}
                    custom={direction}
                    initial={(slideDirection) => ({ opacity: 0, x: slideDirection * 72 })}
                    animate={{ opacity: 1, x: 0 }}
                    exit={(slideDirection) => ({ opacity: 0, x: slideDirection * -72 })}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                    {pages[page]}
                </motion.main>
            </AnimatePresence>

            <nav className={styles.navigation} aria-label={t("tour.navigation.label")}>
                <GhostIconButton
                    icon={<ChevronLeft />}
                    onClick={() => moveTo(page - 1)}
                    disabled={page === 0}
                    aria-label={t("tour.navigation.previous")}
                />

                <div className={styles.progress} aria-label={`${page + 1} / ${pages.length}`}>
                    {pages.map((tourPage, index) => (
                        <motion.span
                            key={tourPage.key ?? index}
                            className={styles.dot}
                            animate={{ scale: index === page ? 1.35 : 1, opacity: index === page ? 1 : 0.3 }}
                            transition={{ duration: 0.2 }}
                        />
                    ))}
                </div>

                <GhostIconButton
                    icon={<ChevronRight />}
                    onClick={handleNext}
                    variant={page === pages.length - 1 ? "primary" : "secondary"}
                    aria-label={page === pages.length - 1 ? t("tour.navigation.complete") : t("tour.navigation.next")}
                />
            </nav>
        </div>
    );
}

export default SplashScreen;
