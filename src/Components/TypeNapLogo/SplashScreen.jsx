import React from 'react';
import { motion } from 'framer-motion';

function SplashScreen({ theme = 'dark', onComplete }) {
    const transitionSettings = {
        duration: 2.5,
        ease: "easeInOut",
    };
    const gradientId = "simple-logo-gradient";

    const handleAnimationComplete = () => {
        if (onComplete) {
            setTimeout(() => onComplete(), 500);
        }
    };

    return (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <svg width={1707 * 0.3} height={475 * 0.3} viewBox="0 0 1707 475" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                        {theme === 'light' ? (
                            <>
                                <stop offset="0%" stopColor="#6e8efb" />
                                <stop offset="100%" stopColor="#a777e3" />
                            </>
                        ) : (
                            <>
                                <stop offset="0%" stopColor="#004aad" />
                                <stop offset="100%" stopColor="#cb6ce6" />
                            </>
                        )}
                    </linearGradient>
                </defs>
                <motion.path
                    d="M103.779 305.003L188.08 35.7503M314.025 18.0029C302.853 24.4258 263.05 49.9776 188.08 35.7503C-40.1313 18.0029 5.57407 136.15 72.6101 120.938"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="36"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={transitionSettings}
                />
                <motion.path
                    d="M236.156 177.503C120.656 412.003 292.656 287.003 378.156 177.503M378.156 177.503C359.656 233.003 276.156 491.503 201.156 452.503C146.156 388.003 478.156 229.503 520.656 167.003M378.156 177.503L383.156 167.003M520.656 167.003L502.656 215.503M520.656 167.003L524.156 161.003M409.656 447.503L502.656 215.503M502.656 215.503C705.656 77.0029 640.156 346.502 514.656 303.503M514.656 303.503L507.656 301.003M514.656 303.503C560.679 327.433 704.7 277.887 764.656 229.501C785.656 214.501 798.364 201.132 787.656 181.501C775.656 159.501 739.636 169.479 715.656 197.001C677.39 240.92 659.398 319.46 745.156 317.002C773.656 316.185 798.656 300.001 838.156 259.501"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="36"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={transitionSettings}
                />
                <motion.path
                    d="M1373.09 192.503C1301.89 127.303 1184.16 273.756 1241.09 314.003C1270.09 334.503 1334.59 292.003 1358.09 236.003M1358.09 236.003C1337.59 364.503 1435.09 344.003 1556.09 168.503M1358.09 236.003L1361.09 227.503M1556.09 168.503L1558.09 165.003M1556.09 168.503L1540.59 222.503M1457.59 452.503L1540.59 222.503M1540.59 222.503C1762.59 60.0029 1709.09 383.003 1550.09 306.003"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="36"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={transitionSettings}
                />
                <motion.path
                    d="M909.025 325.405C983.365 307.266 1017.9 118.435 1025.88 26.2875M1025.88 26.2875C1087.77 265.582 1141.27 342.846 1160.28 351.567M1025.88 26.2875L1025.48 18.0029M1160.28 351.567C1168.58 91.3434 1220.9 38.7871 1246.03 45.0369M1160.28 351.567V352.003"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="36"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={transitionSettings}
                    onAnimationComplete={handleAnimationComplete}
                />
            </svg>
        </div>
    );
}

export default SplashScreen;
