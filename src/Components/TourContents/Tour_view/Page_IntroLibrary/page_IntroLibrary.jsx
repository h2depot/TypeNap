import { motion } from "framer-motion";
import { GhostBookCard } from "../../../GhostDesignSystem";
import { SOLID_PALETTE_COLORS } from "../../../../Constants/colors";
import { useTranslation } from "react-i18next";
import styles from "./page_IntroLibrary.module.css";

export default function PageIntroLibrary() {
    const { t } = useTranslation();
    const books = [
        { id: "anne", title: t("tour.library.sampleBooks.anne"), color: SOLID_PALETTE_COLORS[2] },
        { id: "blueBird", title: t("tour.library.sampleBooks.blueBird"), color: SOLID_PALETTE_COLORS[4] },
        { id: "jadeRing", title: t("tour.library.sampleBooks.jadeRing"), color: SOLID_PALETTE_COLORS[3] },
    ];
    const previewMenuItems = [
        { label: t("tour.library.menu.details"), disabled: true },
        { label: t("tour.library.menu.rename"), disabled: true },
        { label: t("tour.library.menu.delete"), isDanger: true, disabled: true },
    ];

    return (
        <motion.div
            className={styles.content}
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } }}
        >
            <motion.div className={styles.books} variants={{ hidden: {}, visible: {} }}>
                {books.map((book, index) => (
                    <motion.div
                        key={book.id}
                        variants={{
                            hidden: { opacity: 0, y: 28, rotate: index - 1 },
                            visible: { opacity: 1, y: 0, rotate: 0 },
                        }}
                        transition={{ type: "spring", stiffness: 180, damping: 20 }}
                    >
                        <GhostBookCard
                            title={book.title}
                            updated="2026-08-29"
                            coverColor={book.color}
                            menuItems={previewMenuItems}
                        />
                    </motion.div>
                ))}
            </motion.div>

            <motion.h1 variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}>
                {t("tour.library.title")}
            </motion.h1>
            <motion.p
                className={styles.description}
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            >
                {t("tour.library.description")}
            </motion.p>
        </motion.div>
    );
}
