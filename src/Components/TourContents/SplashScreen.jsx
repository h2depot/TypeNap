import { Children, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LeftArrow, RightArrow } from "../../assets/IconList";
import { useTranslation } from "react-i18next";
import { TN_IconButton } from "../TNDesignSystem";
import styles from "./SplashScreen.module.css";

function SplashScreen({ tourPages = [], onTourComplete }) {
    const { t } = useTranslation();
    const [page, setPage] = useState(0);
    const [direction, setDirection] = useState(1);
    const pages = Children.toArray(tourPages);

    const moveTo = (nextPage) => {
        if (nextPage < 0 || nextPage >= pages.length) return;
        setDirection(nextPage > page ? 1 : -1);
        setPage(nextPage);
    };

    const handleNext = () => {
        if (page === pages.length - 1) onTourComplete?.();
        else moveTo(page + 1);
    };

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
                <TN_IconButton
                    icon={<LeftArrow />}
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

                <TN_IconButton
                    icon={<RightArrow />}
                    onClick={handleNext}
                    variant={page === pages.length - 1 ? "primary" : "secondary"}
                    aria-label={page === pages.length - 1 ? t("tour.navigation.complete") : t("tour.navigation.next")}
                />
            </nav>
        </div>
    );
}

export default SplashScreen;
