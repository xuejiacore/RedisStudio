import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    build: {
        rollupOptions: {
            input: {
                modifykey: 'windows/modify-key.html',
                createnewkey: 'windows/create-new-key.html',
                splashscreen: 'windows/splashscreen.html',
                datasourcedropdown: 'windows/datasource-dropdown.html',
                datasourcedatabaseselector: 'windows/datasource-database-selector.html',
                redispin: 'windows/redis-pin.html',
                index: 'index.html',
            }
        }
    },

    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
