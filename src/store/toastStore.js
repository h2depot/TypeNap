import { create } from "zustand";

export const useToastStore = create((set) => ({
    toasts: [],
    addToast: (message, type = 'info') => set((state) => ({
        toasts: [...state.toasts, { id: Math.random().toString(36).substring(2, 9), message, type, duration: 4000 }]
    })),
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}));
