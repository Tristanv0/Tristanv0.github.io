import React from "react";
import './Home.css';

const Home = () => {
    return (
        <header className="App-header">
              <h2>
                <code>Hey! I'm Tristan</code>
              </h2>
              <h5>I am a 2nd year Computer Science student at Toronto Metropolitan University.</h5>
              <p>
                Your browser dimensions are {window.innerWidth}x{window.innerHeight}
              </p>
        </header>
    );
};

export default Home;