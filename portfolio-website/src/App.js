import React, { useState } from 'react';
import './App.css';
import Background from './components/background/Background';
import Navbar from './components/navbar/Navbar';
import About from './components/about/AboutPage';
import Home from './components/home/Home';
import Contact from './components/contact/Contact';
import Projects from './components/projects/Projects';
import Resume from './components/resume/Resume';

function App() {
  
  const [isHomeFadeOut, setHomeFadeOut] = useState(false);
  const [isResumeFadeOut, setResumeFadeOut] = useState(true);
  const [isAboutFadeOut, setAboutFadeOut] = useState(true);
  const [isProjectsFadeOut, setProjectsFadeOut] = useState(true);
  const [isContactFadeOut, setContactFadeOut] = useState(true);

  const handleHomeClick = (event) => {
    event.preventDefault();
    console.log('Home link clicked!');
    //make everything fade-out and Home fade-in
    if (isHomeFadeOut) {
      setTimeout(function(){
        setResumeFadeOut(true);
        setAboutFadeOut(true);
        setProjectsFadeOut(true);
        setContactFadeOut(true);
      }, 250);

      setTimeout(function(){
        setHomeFadeOut(false);
      }, 250);
    };
  };

  const handleResumeClick = (event) => {
    event.preventDefault();
    console.log('Resume link clicked!');
    //make everything fade-out and Resume fade-in
    if (isResumeFadeOut) {
      setTimeout(function(){
        setHomeFadeOut(true);
        setAboutFadeOut(true);
        setProjectsFadeOut(true);
        setContactFadeOut(true);
      }, 250);

      setTimeout(function(){
        setResumeFadeOut(false);
      }, 250);
    };
  };

  const handleAboutClick = (event) => {
    event.preventDefault();
    console.log('About link clicked!');
    //make everything fade-out and About fade-in
    if (isAboutFadeOut) {
      setTimeout(function(){
        setHomeFadeOut(true);
        setResumeFadeOut(true);
        setProjectsFadeOut(true);
        setContactFadeOut(true);
      }, 250);

      setTimeout(function(){
        setAboutFadeOut(false);
      }, 250);
    };
  };

  const handleProjectsClick = (event) => {
    event.preventDefault();
    console.log('Projects link clicked!');
    //make everything fade-out and Projects fade-in
    if (isProjectsFadeOut) {
      setTimeout(function(){
        setHomeFadeOut(true);
        setResumeFadeOut(true);
        setAboutFadeOut(true);
        setContactFadeOut(true);
      }, 250);

      setTimeout(function(){
        setProjectsFadeOut(false);
      }, 250);
    };
  };

  const handleContactClick = (event) => {
    event.preventDefault();
    console.log('Contact link clicked!');
    //make everything fade-out and Contact fade-in
    if (isContactFadeOut) {
      setTimeout(function(){
        setHomeFadeOut(true);
        setResumeFadeOut(true);
        setAboutFadeOut(true);
        setProjectsFadeOut(true);
      }, 250);

      setTimeout(function(){
        setContactFadeOut(false);
      }, 250);
    };
  };

  return (
    <div className="App">
      <Background className="App-background">
        <Navbar 
          onHomeClick={handleHomeClick} 
          onResumeClick={handleResumeClick} 
          onAboutClick={handleAboutClick}
          onProjectsClick={handleProjectsClick}
          onContactClick={handleContactClick}
        />
        <div className="App-Content">
          <div className={`App-home ${isHomeFadeOut ? 'fade-out' : 'fade-in'}`}>
            <Home className={`App-home ${isHomeFadeOut ? 'fade-out' : 'fade-in'}`}/>
          </div>
          <div className={`App-about ${isAboutFadeOut ? 'fade-out' : 'fade-in'}`}>
            <About className={`App-about ${isAboutFadeOut ? 'fade-out' : 'fade-in'}`}/>
          </div>
          <div className={`App-resume ${isResumeFadeOut ? 'fade-out' : 'fade-in'}`}>
            <Resume className={`App-resume ${isResumeFadeOut ? 'fade-out' : 'fade-in'}`}/>
          </div>
          <div className={`App-projects ${isProjectsFadeOut ? 'fade-out' : 'fade-in'}`}>
            <Projects className={`App-projects ${isProjectsFadeOut ? 'fade-out' : 'fade-in'}`}/>
          </div>
          <div className={`App-contact ${isContactFadeOut ? 'fade-out' : 'fade-in'}`}>
            <Contact className={`App-contact ${isContactFadeOut ? 'fade-out' : 'fade-in'}`}/>
          </div>
        </div>
      </Background>
    </div>
  );
};

export default App;
