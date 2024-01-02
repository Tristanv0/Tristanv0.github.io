import React, { useEffect } from 'react';
import './Background.css';

function getRandomNum(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const Background = ({ children }) => {
    
    useEffect(() => {
        const maxX = window.innerWidth - 500;
        const maxY = window.innerHeight - 500;
        const circleArray = ['first', 'second', 'third', 'fourth'];
        
        //randomizes position of circle on screen initially
        circleArray.forEach((id) => {
            const randomX = getRandomNum(0, maxX);
            const randomY = getRandomNum(0, maxY);
            const svgCircle = document.getElementById(id);

            if (svgCircle) {
                svgCircle.style.left = `${randomX}px`;
                svgCircle.style.top = `${randomY}px`;
            }
        });
    }, []);

    useEffect(() => {
        const maxX = window.innerWidth - 500;
        const maxY = window.innerHeight - 500;
        const circleArray = ['first', 'second', 'third', 'fourth'];

        circleArray.forEach((id) => {
            const svgCircle = document.getElementById(id);
            if (svgCircle) {
              svgCircle.style.transition = `transform 2s linear`; // Adjust the duration as needed
            }
        });

        //animate circles randomly repeatedly
        const animateCircles = () => {
            circleArray.forEach((id) => {
                const randomPosX = getRandomNum(-maxX, maxX);
                const randomPosY = getRandomNum(-maxY, maxY);
                const svgCircle = document.getElementById(id);
                if (svgCircle) {
                    svgCircle.style.transform = `translate(${randomPosX}px, ${randomPosY}px)`;
                }
            });
            setTimeout(function(){
                requestAnimationFrame(animateCircles);
            }, 1000);
        };
        setTimeout(function(){
            animateCircles();
        }, 1000);
        
    }, []);


    return (
      <div className="animated-background">
        <svg className="circle" id="first" width="400" height="400">
            <circle cx="200" cy="200" r="160" fill="#2ecc71" />
        </svg>
        <svg className="circle" id="second" width="400" height="400">
            <circle cx="200" cy="200" r="160" fill="#2ecc71" />
        </svg>
        <svg className="circle" id="third" width="400" height="400">
            <circle cx="200" cy="200" r="160" fill="#2ecc71" />
        </svg>
        <svg className="circle" id="fourth" width="400" height="400">
            <circle cx="200" cy="200" r="160" fill="#2ecc71" />
        </svg>
        <div className="other-content">
            {children}
        </div>
      </div>
    );
  };

export default Background;