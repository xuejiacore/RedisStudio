import {useEffect} from 'react';
import Scrollbar from 'smooth-scrollbar';

const useSmoothScrollbar = (ref: any) => {
    useEffect(() => {
            console.log('---------->>', ref.current)
        if (ref.current) {
            const scrollbar = Scrollbar.init(ref.current);

            return () => {
                if (scrollbar) {
                    scrollbar.destroy();
                }
            };
        }
    }, [ref]);
};

export default useSmoothScrollbar;
