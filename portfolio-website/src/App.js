import React, { useState } from 'react';
import './App.css';
import Background from './components/background/Background';
import Navbar from './components/navbar/Navbar';
import About from './components/about/AboutPage';
import Home from './components/home/Home'

function App() {
  
  const [isFadeOut, setFadeOut] = useState(false);

  const handleNavbarClick = (event) => {
    console.log(event)
    event.preventDefault();
    console.log('Navbar link clicked!');
    if (isFadeOut) {
      // If isFadeOut is true, set it to false (fade-in)
      setFadeOut(false);
    } else {
      // If isFadeOut is false, set it to true (fade-out)
      setFadeOut(true);
    }
    setFadeOut(!isFadeOut);
  };

  return (
    <div className="App">
      <Background className="App-background">
        <Navbar onClick={handleNavbarClick}/>
        <div className="App-Content">
          <div className={`App-home ${isFadeOut ? 'fade-out' : 'fade-in'}`}>
            <Home/>
          </div>
          <div className={`App-about ${isFadeOut ? 'fade-out' : 'fade-in'}`}>
            <About/>
          </div>
        </div>
      </Background>
    </div>
  );
};

export default App;
