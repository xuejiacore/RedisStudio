import React from "react";
import ReactDOM from "react-dom/client";
import { listen } from '@tauri-apps/api/event';
import RedisPin from "./RedisPin.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <>
        <RedisPin/>
    </>
);
