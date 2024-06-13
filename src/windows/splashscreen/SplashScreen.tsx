import React from "react";
import splash_screen_img from "../../assets/images/splashscreen/splashscreen.jpg";

interface SplashScreenProp {

}

const SplashScreen: React.FC<SplashScreenProp> = (props, context) => {
    return <>
        <img src={splash_screen_img} alt={'cmd'} width={'100%'}/>
    </>
}

export default SplashScreen;