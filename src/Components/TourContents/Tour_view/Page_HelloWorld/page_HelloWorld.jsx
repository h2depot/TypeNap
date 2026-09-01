import { motion } from "framer-motion";
import { BookOpenText } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./page_HelloWorld.module.css";

const helloPath = "M104.073 364.638L136.674 211.9L169.08 60.0737C169.203 59.4961 169.061 58.882 168.684 58.427C135.267 18.0757 17.9996 82.7424 18 114.447C18.0004 148.466 33.9046 161.225 92.0179 148.466M136.674 211.9H264.966M317.415 211.9H264.966M264.966 211.9L302.531 54.9112M264.966 211.9C194.088 439.058 346.475 342.667 393.963 308.647M393.963 308.647C572.575 209.42 509.494 131.457 425.858 196.663C381.205 234.936 389.71 291.636 393.963 308.647ZM1077 185.51C1019 149.51 948.894 218.01 943.265 271.087C939.905 302.764 890.815 365.881 851.833 358.972C739.846 339.127 860.338 8.13744 887.271 22.3126C907.117 32.7574 842.618 164.773 806.471 212.259C766.779 280.3 705.116 361.787 667.551 365.351C570.448 374.565 665.564 -1.01756 705.116 18.7646C729.214 30.8177 657.628 155.563 618.645 212.259C563.361 318.573 443.577 430.553 393.963 308.647M943.265 271.087C991 463.01 1199 255.51 1041.5 226.51M1253 59.8767C1193.15 166.849 1183.23 246.938 1186.77 285.92M1186.77 358.972V366.01";

export default function PageHelloWorld() {
    const { t } = useTranslation();

    return (
        <motion.div
            className={styles.content}
            initial="hidden"
            animate="visible"
        >
            <div className={styles.mark}>
                <motion.svg
                    className={styles.hello}
                    viewBox="0 0 1271 384"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="Hello"
                >
                    <defs>
                        <linearGradient id="welcome-gradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#004aad" />
                            <stop offset="100%" stopColor="#cb6ce6" />
                        </linearGradient>
                    </defs>
                    <motion.path
                        d={helloPath}
                        stroke="url(#welcome-gradient)"
                        strokeWidth="36"
                        strokeLinecap="round"
                        variants={{
                            hidden: { pathLength: 0, opacity: 0 },
                            visible: { pathLength: 1, opacity: 1 },
                        }}
                        transition={{ pathLength: { duration: 2.2, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
                    />
                </motion.svg>

                <motion.div
                    className={styles.icon}
                    variants={{
                        hidden: { opacity: 0, x: -12, scale: 0.88 },
                        visible: { opacity: 1, x: 0, scale: 1 },
                    }}
                    transition={{ delay: 2, duration: 0.45, ease: "easeOut" }}
                    aria-hidden="true"
                >
                    <BookOpenText color="url(#welcome-gradient)" />
                </motion.div>
            </div>

            <motion.h1
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                transition={{ delay: 0.35, duration: 0.55 }}
            >
                {t("tour.welcome.title")}
            </motion.h1>
            <motion.p
                className={styles.description}
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                transition={{ delay: 0.55, duration: 0.55 }}
            >
                {t("tour.welcome.description")}
            </motion.p>
        </motion.div>
    );
}
