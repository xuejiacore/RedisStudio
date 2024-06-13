// components/Scrollbar.js
import React, {useEffect, useRef} from 'react';
import Scrollbar from 'smooth-scrollbar';

// @ts-ignore
const SmoothScrollbar = ({children}) => {
    const scrollbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollbar = Scrollbar.init(scrollbarRef.current!, {
            damping: 0.1,
            alwaysShowTracks: true
        });

        return () => {
            if (scrollbar) scrollbar.destroy();
        };
    }, []);

    return (
        <div ref={scrollbarRef} style={{height: '100vh', overflow: 'hidden'}}>
            {children}
        </div>
    );
};

export default SmoothScrollbar;
