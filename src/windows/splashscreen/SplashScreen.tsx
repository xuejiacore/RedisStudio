import React, {useEffect, useRef, useState} from "react";
import splash_screen_img from "../../assets/images/splashscreen/splashscreen.jpg";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import "./SplashScreen.less";
interface SplashScreenProp {

}

const SplashScreen: React.FC<SplashScreenProp> = (props, context) => {
    let refreshTimer: any = undefined;
    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    const [tips, setTips] = useState('Loading ...');
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                const loadData = () => {

                };

                console.log("listening ...")
                listen('splashscreen_progress', (event) => {
                    console.log("listening ...", event.payload);
                    if (removeListenerIdRef.current != ts) {
                        const payload: any = event.payload;
                        console.log("接收到数据", payload);
                        setTips(payload.tips);
                        clearInterval(refreshTimer);
                        refreshTimer = null;
                    }
                }).then(unlistenFn => {
                    if (removeListenerIdRef.current != ts) {
                        loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                });
            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        /*

         */
        return () => {
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }

            removeListenerAsync().then(t => {
            });
        };
    }, []);
    return <>
        <div className={'splashscreen_container'}>
            <div className={'footer-info'}>{tips}</div>
        </div>
    </>
}

export default SplashScreen;